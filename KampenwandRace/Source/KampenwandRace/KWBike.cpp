#include "KWBike.h"
#include "KWShapes.h"
#include "KWTrack.h"
#include "KWGameMode.h"
#include "KampenwandRace.h"
#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"
#include "Engine/CollisionProfile.h"
#include <cmath>

// -----------------------------------------------------------------------------
// Geometrie (cm). Root = Rahmen-Box; BB = Tretlager relativ zum Root.
// Bike-Raum: X vorn, Y rechts, Z oben.
// -----------------------------------------------------------------------------
namespace
{
	constexpr float Gravity = 9.81f;
	constexpr float TotalMassKg = 92.f;          // 17 kg Bike + 75 kg Fahrer
	constexpr float WheelRadiusCm = 37.f;        // 29"-Reifen
	constexpr float WheelbaseM = 1.25f;
	constexpr float CrankCm = 17.f;
	constexpr float ThighCm = 44.f, ShinCm = 44.f, UpperArmCm = 29.f, ForeArmCm = 28.f, TorsoCm = 52.f;
	constexpr float HeadAngleDeg = 63.f;

	const FVector BB(-10.f, 0.f, -30.f);
	FORCEINLINE FVector B(float X, float Y, float Z) { return BB + FVector(X, Y, Z); }

	const FVector HipNeutral = B(-14.f, 0.f, 70.f);  // Angriffsposition: stehend, Knie gebeugt
	const FVector SwingPivot = B(4.f, 0.f, 12.f);

	/** Zwei-Knochen-IK: liefert das Gelenk (Knie/Ellbogen) zwischen Root und End. */
	FVector SolveJoint(const FVector& Root, FVector& InOutEnd, float L1, float L2, const FVector& PoleDir)
	{
		FVector D = InOutEnd - Root;
		float Dist = D.Size();
		const FVector Dn = Dist > KINDA_SMALL_NUMBER ? D / Dist : FVector::ForwardVector;
		const float MaxReach = L1 + L2 - 0.5f;
		if (Dist > MaxReach)
		{
			Dist = MaxReach;
			InOutEnd = Root + Dn * Dist;
		}
		Dist = FMath::Max(Dist, FMath::Abs(L1 - L2) + 1.f);
		const float A = (L1 * L1 - L2 * L2 + Dist * Dist) / (2.f * Dist);
		const float H = FMath::Sqrt(FMath::Max(L1 * L1 - A * A, 0.f));
		FVector Pole = PoleDir - Dn * FVector::DotProduct(PoleDir, Dn);
		Pole = Pole.GetSafeNormal(KINDA_SMALL_NUMBER, FVector::UpVector);
		return Root + Dn * A + Pole * H;
	}

	FORCEINLINE float ToRad(float Deg) { return FMath::DegreesToRadians(Deg); }
	FORCEINLINE float Tanh(float X) { return std::tanh(X); }
}

// -----------------------------------------------------------------------------
AKWBike::AKWBike()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;
	AutoPossessPlayer = EAutoReceiveInput::Disabled;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeF(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylF(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphF(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	UStaticMesh* CubeM = CubeF.Object;
	UStaticMesh* CylM = CylF.Object;
	UStaticMesh* SphM = SphF.Object;

	// --- Rahmen: Starrkoerper fuer Bike + Fahrer ---
	Frame = CreateDefaultSubobject<UBoxComponent>(TEXT("Frame"));
	RootComponent = Frame;
	Frame->SetBoxExtent(FVector(45.f, 8.f, 24.f));
	Frame->SetCollisionProfileName(UCollisionProfile::PhysicsActor_ProfileName);
	Frame->SetSimulatePhysics(true);
	Frame->SetMassOverrideInKg(NAME_None, TotalMassKg, true);
	Frame->BodyInstance.COMNudge = FVector(-16.f, 0.f, 25.f);           // Schwerpunkt ~90 cm ueber Boden
	Frame->BodyInstance.InertiaTensorScale = FVector(5.f, 2.f, 2.f);   // Fahrer erhoeht Traegheit
	Frame->BodyInstance.bUseCCD = true;
	Frame->SetLinearDamping(0.f);
	Frame->SetAngularDamping(0.4f);
	Frame->SetNotifyRigidBodyCollision(true);
	Frame->SetHiddenInGame(true);
	Frame->SetCanEverAffectNavigation(false);

	BikeVisual = CreateDefaultSubobject<USceneComponent>(TEXT("BikeVisual"));
	BikeVisual->SetupAttachment(Frame);
	RiderRoot = CreateDefaultSubobject<USceneComponent>(TEXT("RiderRoot"));
	RiderRoot->SetupAttachment(Frame);

	// --- Federung ---
	Rear.ExtendedAxle = B(-44.f, 0.f, -3.f);
	Rear.Dir = FVector(-0.12f, 0.f, -1.f).GetSafeNormal();
	Rear.TravelCm = 20.f;
	Rear.SpringNpm = 9000.f;
	Rear.DampCompNspm = 450.f;
	Rear.DampRebNspm = 700.f;
	Rear.BrakeShare = 0.42f;

	Front.ExtendedAxle = B(81.f, 0.f, -3.f);
	Front.Dir = FVector(FMath::Cos(ToRad(HeadAngleDeg)), 0.f, -FMath::Sin(ToRad(HeadAngleDeg)));
	Front.TravelCm = 20.f;
	Front.SpringNpm = 6000.f;
	Front.DampCompNspm = 260.f;
	Front.DampRebNspm = 380.f;
	Front.BrakeShare = 0.58f;
	Front.bFront = true;

	FrontPivot = CreateDefaultSubobject<USceneComponent>(TEXT("FrontPivot"));
	FrontPivot->SetupAttachment(BikeVisual);
	RearPivot = CreateDefaultSubobject<USceneComponent>(TEXT("RearPivot"));
	RearPivot->SetupAttachment(BikeVisual);
	const TCHAR* WheelNames[6] = { TEXT("FrontTire"), TEXT("FrontRim"), TEXT("FrontSpokes"), TEXT("RearTire"), TEXT("RearRim"), TEXT("RearSpokes") };
	for (int32 i = 0; i < 6; ++i)
	{
		UInstancedStaticMeshComponent* ISM = CreateDefaultSubobject<UInstancedStaticMeshComponent>(WheelNames[i]);
		ISM->SetupAttachment(i < 3 ? FrontPivot : RearPivot);
		ISM->SetStaticMesh(i % 3 == 2 ? CylM : CubeM);
		ISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		ISM->SetGenerateOverlapEvents(false);
		WheelISMs.Add(ISM);
	}

	// --- Bike-Teile ---
	TopTube = MakePart(BikeVisual, TEXT("TopTube"), CylM);
	DownTube = MakePart(BikeVisual, TEXT("DownTube"), CylM);
	SeatTube = MakePart(BikeVisual, TEXT("SeatTube"), CylM);
	Saddle = MakePart(BikeVisual, TEXT("Saddle"), CubeM);
	HeadTube = MakePart(BikeVisual, TEXT("HeadTube"), CylM);
	SwingArm = MakePart(BikeVisual, TEXT("SwingArm"), CylM);
	SeatStay = MakePart(BikeVisual, TEXT("SeatStay"), CylM);
	ShockBody = MakePart(BikeVisual, TEXT("ShockBody"), CylM);
	ShockSpring = MakePart(BikeVisual, TEXT("ShockSpring"), CylM);
	ForkUpperL = MakePart(BikeVisual, TEXT("ForkUpperL"), CylM);
	ForkUpperR = MakePart(BikeVisual, TEXT("ForkUpperR"), CylM);
	ForkLowerL = MakePart(BikeVisual, TEXT("ForkLowerL"), CylM);
	ForkLowerR = MakePart(BikeVisual, TEXT("ForkLowerR"), CylM);
	ForkCrown = MakePart(BikeVisual, TEXT("ForkCrown"), CubeM);
	Stem = MakePart(BikeVisual, TEXT("Stem"), CubeM);
	Bar = MakePart(BikeVisual, TEXT("Bar"), CylM);
	CrankL = MakePart(BikeVisual, TEXT("CrankL"), CubeM);
	CrankR = MakePart(BikeVisual, TEXT("CrankR"), CubeM);
	PedalL = MakePart(BikeVisual, TEXT("PedalL"), CubeM);
	PedalR = MakePart(BikeVisual, TEXT("PedalR"), CubeM);
	Chainring = MakePart(BikeVisual, TEXT("Chainring"), CylM);

	// --- Fahrer-Teile ---
	Pelvis = MakePart(RiderRoot, TEXT("Pelvis"), SphM);
	Torso = MakePart(RiderRoot, TEXT("Torso"), CylM);
	Backpack = MakePart(RiderRoot, TEXT("Backpack"), CubeM);
	Neck = MakePart(RiderRoot, TEXT("Neck"), CylM);
	Head = MakePart(RiderRoot, TEXT("Head"), SphM);
	Helmet = MakePart(RiderRoot, TEXT("Helmet"), SphM);
	ChinBar = MakePart(RiderRoot, TEXT("ChinBar"), CubeM);
	Goggles = MakePart(RiderRoot, TEXT("Goggles"), CubeM);
	Peak = MakePart(RiderRoot, TEXT("Peak"), CubeM);
	UpperArmL = MakePart(RiderRoot, TEXT("UpperArmL"), CylM);
	UpperArmR = MakePart(RiderRoot, TEXT("UpperArmR"), CylM);
	ForeArmL = MakePart(RiderRoot, TEXT("ForeArmL"), CylM);
	ForeArmR = MakePart(RiderRoot, TEXT("ForeArmR"), CylM);
	HandL = MakePart(RiderRoot, TEXT("HandL"), SphM);
	HandR = MakePart(RiderRoot, TEXT("HandR"), SphM);
	ThighL = MakePart(RiderRoot, TEXT("ThighL"), CylM);
	ThighR = MakePart(RiderRoot, TEXT("ThighR"), CylM);
	ShinL = MakePart(RiderRoot, TEXT("ShinL"), CylM);
	ShinR = MakePart(RiderRoot, TEXT("ShinR"), CylM);
	KneePadL = MakePart(RiderRoot, TEXT("KneePadL"), SphM);
	KneePadR = MakePart(RiderRoot, TEXT("KneePadR"), SphM);
	ShoeL = MakePart(RiderRoot, TEXT("ShoeL"), CubeM);
	ShoeR = MakePart(RiderRoot, TEXT("ShoeR"), CubeM);

	// --- Kameras ---
	CamArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CamArm"));
	CamArm->SetupAttachment(Frame);
	CamArm->SetRelativeLocation(B(0.f, 0.f, 90.f));
	CamArm->SetUsingAbsoluteRotation(true);
	CamArm->TargetArmLength = 430.f;
	CamArm->SocketOffset = FVector(0.f, 0.f, 120.f);
	CamArm->bEnableCameraLag = true;
	CamArm->CameraLagSpeed = 9.f;
	CamArm->CameraLagMaxDistance = 300.f;
	CamArm->bDoCollisionTest = true;
	CamArm->ProbeSize = 15.f;

	ChaseCam = CreateDefaultSubobject<UCameraComponent>(TEXT("ChaseCam"));
	ChaseCam->SetupAttachment(CamArm, USpringArmComponent::SocketName);
	ChaseCam->SetFieldOfView(82.f);

	HelmetCam = CreateDefaultSubobject<UCameraComponent>(TEXT("HelmetCam"));
	HelmetCam->SetupAttachment(Frame);
	HelmetCam->SetFieldOfView(95.f);
	HelmetCam->SetAutoActivate(false);
}

UStaticMeshComponent* AKWBike::MakePart(USceneComponent* Parent, const TCHAR* Name, UStaticMesh* Mesh)
{
	UStaticMeshComponent* C = CreateDefaultSubobject<UStaticMeshComponent>(Name);
	C->SetupAttachment(Parent);
	C->SetStaticMesh(Mesh);
	C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	C->SetGenerateOverlapEvents(false);
	C->SetCanEverAffectNavigation(false);
	C->CanCharacterStepUpOn = ECB_No;
	return C;
}

// -----------------------------------------------------------------------------
void AKWBike::BeginPlay()
{
	Super::BeginPlay();
	Frame->OnComponentHit.AddDynamic(this, &AKWBike::OnFrameHit);

	BuildWheelVisual(FrontPivot, 0);
	BuildWheelVisual(RearPivot, 3);

	// statische Rahmenrohre
	const FVector Crown = Front.ExtendedAxle - Front.Dir * (Front.TravelCm + 38.f);
	const FVector HTBottom = Crown - Front.Dir * 1.f;
	const FVector HTTop = Crown - Front.Dir * 14.f;
	KWShapes::PlaceBetween(HeadTube, HTBottom, HTTop, 3.4f);
	KWShapes::PlaceBetween(DownTube, B(2.f, 0.f, 4.f), HTBottom + FVector(0, 0, 2.f), 3.6f, 3.0f);
	KWShapes::PlaceBetween(TopTube, B(-10.f, 0.f, 40.f), HTTop - FVector(0, 0, 2.f), 2.8f, 2.4f);
	KWShapes::PlaceBetween(SeatTube, B(0.f, 0.f, 2.f), B(-12.f, 0.f, 44.f), 2.8f);
	Saddle->SetRelativeTransform(KWShapes::Box(B(-15.f, 0.f, 47.f), FVector(26.f, 13.f, 6.f), FRotator(-4.f, 0.f, 0.f)));
	KWShapes::PlaceBetween(Chainring, B(0.f, 5.f, 0.f), B(0.f, 5.6f, 0.f), 9.f);

	ApplyColors();
	UpdateBikeVisual(0.f);
	UpdateRiderRig();
	CamRot = FRotator(-14.f, GetActorRotation().Yaw, 0.f);
}

void AKWBike::BuildWheelVisual(USceneComponent* Pivot, int32 Index)
{
	UInstancedStaticMeshComponent* Tire = WheelISMs[Index];
	UInstancedStaticMeshComponent* Rim = WheelISMs[Index + 1];
	UInstancedStaticMeshComponent* Spokes = WheelISMs[Index + 2];
	Tire->ClearInstances(); Rim->ClearInstances(); Spokes->ClearInstances();

	const int32 Segs = 30;
	for (int32 i = 0; i < Segs; ++i)
	{
		const float A = 2.f * PI * i / Segs;
		const FVector Radial(FMath::Cos(A), 0.f, FMath::Sin(A));
		const FVector Tangent(-FMath::Sin(A), 0.f, FMath::Cos(A));
		const FRotator R = FRotationMatrix::MakeFromXZ(Tangent, Radial).Rotator();
		const float SegLen = 2.f * PI * 34.f / Segs * 1.08f;
		Tire->AddInstance(FTransform(R, Radial * 34.f, FVector(SegLen / 100.f, 0.064f, 0.066f)));
		Rim->AddInstance(FTransform(R, Radial * 29.5f, FVector(SegLen * 0.88f / 100.f, 0.03f, 0.03f)));
	}
	// Speichen, Nabe, Bremsscheibe
	for (int32 i = 0; i < 16; ++i)
	{
		const float A = 2.f * PI * i / 16.f;
		const float Side = (i % 2 == 0) ? 3.f : -3.f;
		const FVector Hub(FMath::Cos(A + 0.4f) * 3.f, Side, FMath::Sin(A + 0.4f) * 3.f);
		const FVector RimP(FMath::Cos(A) * 28.f, Side * 0.15f, FMath::Sin(A) * 28.f);
		Spokes->AddInstance(KWShapes::Between(Hub, RimP, 0.45f));
	}
	Spokes->AddInstance(KWShapes::Between(FVector(0, -6.f, 0), FVector(0, 6.f, 0), 3.2f));
	Spokes->AddInstance(KWShapes::Between(FVector(0, -4.6f, 0), FVector(0, -4.1f, 0), 10.f));
}

void AKWBike::ApplyColors()
{
	UMaterialInstanceDynamic* Jersey = KWShapes::Color(this, JerseyColor);
	UMaterialInstanceDynamic* Pants = KWShapes::Color(this, PantsColor);
	UMaterialInstanceDynamic* FrameM = KWShapes::Color(this, FrameColor);
	UMaterialInstanceDynamic* Black = KWShapes::Color(this, FLinearColor(0.02f, 0.02f, 0.02f));
	UMaterialInstanceDynamic* Dark = KWShapes::Color(this, FLinearColor(0.07f, 0.07f, 0.08f));
	UMaterialInstanceDynamic* Silver = KWShapes::Color(this, FLinearColor(0.55f, 0.56f, 0.58f));
	UMaterialInstanceDynamic* Gold = KWShapes::Color(this, FLinearColor(0.75f, 0.45f, 0.08f));
	UMaterialInstanceDynamic* Skin = KWShapes::Color(this, FLinearColor(0.72f, 0.48f, 0.36f));
	UMaterialInstanceDynamic* Lens = KWShapes::Color(this, FLinearColor(0.9f, 0.35f, 0.02f));
	UMaterialInstanceDynamic* HelmetM = KWShapes::Color(this, JerseyColor * 0.6f + FLinearColor(0.35f, 0.35f, 0.35f));

	WheelISMs[0]->SetMaterial(0, Black); WheelISMs[3]->SetMaterial(0, Black);
	WheelISMs[1]->SetMaterial(0, Dark); WheelISMs[4]->SetMaterial(0, Dark);
	WheelISMs[2]->SetMaterial(0, Silver); WheelISMs[5]->SetMaterial(0, Silver);

	for (UStaticMeshComponent* C : { TopTube, DownTube, SeatTube, HeadTube, SwingArm, SeatStay }) C->SetMaterial(0, FrameM);
	for (UStaticMeshComponent* C : { Saddle, Stem, Bar, CrankL, CrankR, PedalL, PedalR, ForkCrown, ForkLowerL, ForkLowerR, Chainring, ShockBody }) C->SetMaterial(0, Dark);
	for (UStaticMeshComponent* C : { ForkUpperL, ForkUpperR }) C->SetMaterial(0, Gold);
	ShockSpring->SetMaterial(0, Lens);

	for (UStaticMeshComponent* C : { Torso, UpperArmL, UpperArmR, ForeArmL, ForeArmR }) C->SetMaterial(0, Jersey);
	for (UStaticMeshComponent* C : { Pelvis, ThighL, ThighR, ShinL, ShinR }) C->SetMaterial(0, Pants);
	for (UStaticMeshComponent* C : { HandL, HandR, ShoeL, ShoeR, KneePadL, KneePadR, Backpack }) C->SetMaterial(0, Black);
	for (UStaticMeshComponent* C : { Head, Neck }) C->SetMaterial(0, Skin);
	for (UStaticMeshComponent* C : { Helmet, ChinBar, Peak }) C->SetMaterial(0, HelmetM);
	Goggles->SetMaterial(0, Lens);
}

void AKWBike::SetupRider(const FString& InName, const FLinearColor& Jersey, const FLinearColor& Pants, const FLinearColor& BikeColor, bool bInAI, float InSkill, float InLane)
{
	RiderName = InName;
	JerseyColor = Jersey;
	PantsColor = Pants;
	FrameColor = BikeColor;
	bIsAI = bInAI;
	AISkill = InSkill;
	AILane = InLane;
	if (HasActorBegunPlay())
	{
		ApplyColors();
	}
}

AKWTrack* AKWBike::GetTrack() const
{
	if (const AKWGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<AKWGameMode>() : nullptr)
	{
		return GM->GetTrack();
	}
	return nullptr;
}

float AKWBike::GetSpeedKmh() const
{
	return Frame->GetPhysicsLinearVelocity().Size() * 0.036f;
}

void AKWBike::ToggleCamera()
{
	bHelmetCam = !bHelmetCam;
	ChaseCam->SetActive(!bHelmetCam);
	HelmetCam->SetActive(bHelmetCam);
	// Im Helm-Modus Kopf/Helm ausblenden, damit sie nicht ins Bild ragen
	for (UStaticMeshComponent* C : { Head, Helmet, ChinBar, Goggles, Peak, Neck })
	{
		C->SetOwnerNoSee(bHelmetCam);
	}
}

// -----------------------------------------------------------------------------
void AKWBike::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	const float Dt = FMath::Clamp(DeltaSeconds, 1.f / 240.f, 1.f / 30.f);

	if (bIsAI) ComputeAIInput(Dt);
	if (bFrozen) { Input.Pedal = 0.f; Input.Brake = 1.f; Input.Steer = 0.f; }
	if (IsCrashed()) { Input = FKWBikeInput(); }
	if (FinishTime >= 0.f && bIsAI) { Input.Pedal = 0.f; Input.Brake = 0.6f; }

	// Lenkung: weich nachfuehren, Lenkwinkel mit Tempo reduzieren
	const float SpeedMS = Frame->GetPhysicsLinearVelocity().Size() / 100.f;
	SteerSmoothed = FMath::FInterpConstantTo(SteerSmoothed, Input.Steer, Dt, 4.5f);
	const float MaxSteerDeg = FMath::Lerp(30.f, 5.5f, FMath::Clamp(SpeedMS / 18.f, 0.f, 1.f));
	SteerAngleRad = ToRad(SteerSmoothed * MaxSteerDeg);

	const bool bWasAirborne = IsAirborne();
	if (bWasAirborne) PreLandingVel = Frame->GetPhysicsLinearVelocity() / 100.f;

	float DriveN = 0.f;
	UpdateWheel(Rear, Dt, 0.f, DriveN);
	UpdateWheel(Front, Dt, SteerAngleRad, DriveN);

	// Luftwiderstand (CdA ~0.55 m^2 fuer Fahrer in Abfahrtshaltung)
	{
		const FVector V = Frame->GetPhysicsLinearVelocity() / 100.f;
		const FVector Drag = -0.5f * 1.2f * 0.55f * V.Size() * V;
		Frame->AddForce(Drag * 100.f);
	}

	// Landung / Airtime / Tricks
	if (IsAirborne())
	{
		AirTime += Dt;
		AirYawAccum += FVector::DotProduct(Frame->GetPhysicsAngularVelocityInRadians(), FVector::UpVector) * Dt;
	}
	else if (bWasAirborne)
	{
		if (AirTime > 0.45f && !IsCrashed())
		{
			const int32 Spins = FMath::RoundToInt(FMath::Abs(AirYawAccum) / (2.f * PI));
			LastTrick = Spins >= 1 ? FString::Printf(TEXT("%d60!  %.1f s Airtime"), Spins * 3, AirTime)
			                       : FString::Printf(TEXT("Airtime %.1f s"), AirTime);
			TrickTimer = 2.f;
		}
		AirTime = 0.f;
		AirYawAccum = 0.f;
	}
	TrickTimer = FMath::Max(0.f, TrickTimer - Dt);

	if (!IsCrashed())
	{
		UpdateBalanceAndAir(Dt);
	}
	UpdateRiderDynamics(Dt);
	CheckCrash(Dt);

	if (IsCrashed())
	{
		CrashTimer -= Dt;
		if (CrashTimer <= 0.f)
		{
			ResetToTrack(5.f);
		}
	}

	UpdateBikeVisual(Dt);
	UpdateRiderRig();
	UpdateCamera(Dt);
}

// -----------------------------------------------------------------------------
// Federung + Reifen
// -----------------------------------------------------------------------------
void AKWBike::UpdateWheel(FKWWheel& W, float Dt, float SteerRad, float& InOutDriveN)
{
	const FTransform& T = Frame->GetComponentTransform();
	const FVector DirW = T.TransformVectorNoScale(W.Dir);
	const FVector Start = T.TransformPosition(W.AxleTop());
	const FVector End = Start + DirW * (W.TravelCm + 2.f);

	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(KWWheel), false, this);
	FCollisionObjectQueryParams ObjParams;
	ObjParams.AddObjectTypesToQuery(ECC_WorldStatic);
	ObjParams.AddObjectTypesToQuery(ECC_WorldDynamic);
	const bool bHit = GetWorld()->SweepSingleByObjectType(Hit, Start, End, FQuat::Identity, ObjParams,
		FCollisionShape::MakeSphere(WheelRadiusCm), Params);

	W.PrevCompressionCm = W.CompressionCm;
	W.bSkidding = false;
	if (!bHit || (!Hit.bStartPenetrating && Hit.Distance > W.TravelCm))
	{
		// Rad in der Luft: Feder streckt sich (begrenzt durch Zugstufe)
		W.bContact = false;
		W.CompressionCm = FMath::Max(0.f, W.CompressionCm - Dt * 180.f);
		W.LoadN = 0.f;
		return;
	}

	W.bContact = true;
	W.CompressionCm = Hit.bStartPenetrating ? W.TravelCm : FMath::Clamp(W.TravelCm - Hit.Distance, 0.f, W.TravelCm);
	W.ContactPoint = Hit.ImpactPoint;
	W.ContactNormal = Hit.ImpactNormal;

	// --- Feder-Daempfer (SI) ---
	const float X = W.CompressionCm / 100.f;
	const float TravelM = W.TravelCm / 100.f;
	const float XDot = (W.CompressionCm - W.PrevCompressionCm) / 100.f / Dt;
	const float Prog = 1.f + 1.6f * FMath::Square(X / TravelM);          // progressive Kennlinie
	float Fs = W.SpringNpm * X * Prog + (XDot > 0.f ? W.DampCompNspm : W.DampRebNspm) * XDot;
	const float BumpStart = 0.9f * TravelM;
	if (X > BumpStart) Fs += 90000.f * (X - BumpStart);                // Durchschlagpuffer
	if (Hit.bStartPenetrating) Fs += 4000.f;
	Fs = FMath::Max(Fs, 0.f);

	const FVector AxleW = T.TransformPosition(W.AxleLocal());
	Frame->AddForceAtLocation(-DirW * Fs * 100.f, AxleW);

	const FVector N = W.ContactNormal;
	W.LoadN = Fs * FMath::Max(FVector::DotProduct(-DirW, N), 0.3f);

	// --- Reifen ---
	FVector Heading = T.GetUnitAxis(EAxis::X);
	if (W.bFront && FMath::Abs(SteerRad) > KINDA_SMALL_NUMBER)
	{
		Heading = FQuat(-DirW, SteerRad).RotateVector(Heading);   // um die Lenkachse drehen
	}
	const FVector Fwd = (Heading - N * FVector::DotProduct(Heading, N)).GetSafeNormal();
	const FVector Lat = FVector::CrossProduct(N, Fwd);
	const FVector Vp = Frame->GetPhysicsLinearVelocityAtPoint(W.ContactPoint) / 100.f;
	const float VLong = FVector::DotProduct(Vp, Fwd);
	const float VLat = FVector::DotProduct(Vp, Lat);

	// Untergrund: auf dem Trail griffiger Erdboden, daneben Wiese/Waldboden
	const bool bOnTrail = LateralOffsetM < 2.6f;
	const float Mu = bOnTrail ? 0.95f : 0.72f;
	const float Crr = bOnTrail ? 0.022f : 0.07f;
	const float MaxF = Mu * W.LoadN;

	float Fx = 0.f;
	if (!W.bFront && Input.Pedal > 0.f)
	{
		// ~750 W Sprintleistung, begrenzt durch Kraft am Pedal
		Fx += Input.Pedal * FMath::Min(750.f / FMath::Max(VLong, 1.f), 420.f);
	}
	Fx -= Input.Brake * W.BrakeShare * 1.6f * MaxF * Tanh(VLong / 0.15f);
	Fx -= Crr * W.LoadN * Tanh(VLong / 0.4f);

	const float SlipRef = 0.10f * FMath::Max(FMath::Abs(VLong), 1.5f);  // ~6 Grad Schraeglaufwinkel bis Haftgrenze
	float Fy = -MaxF * Tanh(VLat / SlipRef);

	// Reibungskreis
	const float FMag = FMath::Sqrt(Fx * Fx + Fy * Fy);
	if (FMag > MaxF && FMag > KINDA_SMALL_NUMBER)
	{
		const float S = MaxF / FMag;
		Fx *= S; Fy *= S;
		W.bSkidding = true;
	}
	Frame->AddForceAtLocation((Fwd * Fx + Lat * Fy) * 100.f, W.ContactPoint);

	W.SpinDeg += FMath::RadiansToDegrees(VLong / (WheelRadiusCm / 100.f) * Dt) * (W.bSkidding && Input.Brake > 0.5f ? 0.2f : 1.f);
	InOutDriveN += Fx;
}

// -----------------------------------------------------------------------------
// Balance am Boden, Koerpereinsatz in der Luft
// -----------------------------------------------------------------------------
void AKWBike::UpdateBalanceAndAir(float Dt)
{
	const FTransform& T = Frame->GetComponentTransform();
	const FVector Fw = T.GetUnitAxis(EAxis::X);
	const FVector Rw = T.GetUnitAxis(EAxis::Y);
	const FVector Up = T.GetUnitAxis(EAxis::Z);
	const FVector Z = FVector::UpVector;
	const FVector Omega = Frame->GetPhysicsAngularVelocityInRadians();
	const FVector V = Frame->GetPhysicsLinearVelocity() / 100.f;
	const float VFwd = FVector::DotProduct(V, Fw);

	const float Grounded = (Front.bContact ? 0.5f : 0.f) + (Rear.bContact ? 0.5f : 0.f);
	FVector Alpha = FVector::ZeroVector;   // gewuenschte Winkelbeschleunigung (rad/s^2)

	if (Grounded > 0.f)
	{
		// Gleichgewichts-Schraeglage: tan(phi) = v * Gierrate / g, plus Vorsteuerung aus dem Lenkeinschlag
		const float YawRate = FVector::DotProduct(Omega, Z);
		const float Kappa = FMath::Tan(SteerAngleRad) / WheelbaseM;
		const float Lateral = 0.6f * VFwd * YawRate + 0.4f * VFwd * FMath::Abs(VFwd) * Kappa;
		const float PhiT = FMath::Clamp(FMath::Atan(Lateral / Gravity), -0.95f, 0.95f);

		const FVector Fh = FVector(Fw.X, Fw.Y, 0.f).GetSafeNormal();
		const FVector Rh = FVector::CrossProduct(Z, Fh).GetSafeNormal();
		const FVector UpT = Z * FMath::Cos(PhiT) + Rh * FMath::Sin(PhiT);
		const float Err = FVector::DotProduct(FVector::CrossProduct(Up, UpT), Fw);
		const float RollRate = FVector::DotProduct(Omega, Fw);
		const float Wn = 8.f, Zeta = 0.9f;
		Alpha += Fw * (Wn * Wn * Err - 2.f * Zeta * Wn * RollRate) * Grounded;

		// leichte Giergedaempfung (Reifen-Selbststabilisierung / Nachlauf)
		Alpha -= Z * YawRate * 0.6f * Grounded * (1.f - FMath::Abs(SteerSmoothed));
	}

	if (Grounded <= 0.f && AirTime > 0.06f)
	{
		// Pitch: nach vorn druecken / zurueckziehen
		Alpha += Rw * (Input.Pitch * 5.5f);
		// Fahrer haelt das Bike instinktiv parallel zur Flugbahn (ausser er lehnt aktiv)
		const FVector Vd = V.GetSafeNormal();
		const float PitchErr = FVector::DotProduct(FVector::CrossProduct(Fw, Vd), Rw);
		Alpha += Rw * PitchErr * 3.f * (1.f - FMath::Abs(Input.Pitch));
		// Whip / Drehung um die Hochachse; ohne Eingabe dreht er zurueck in Flugrichtung
		const FVector Fh = FVector(Fw.X, Fw.Y, 0.f).GetSafeNormal();
		const FVector Vh = FVector(V.X, V.Y, 0.f).GetSafeNormal();
		const float YawErr = FVector::DotProduct(FVector::CrossProduct(Fh, Vh), Z);
		Alpha += Z * (Input.Steer * 7.f + YawErr * 4.f * (1.f - FMath::Abs(Input.Steer)));
		// Rollachse: aufrichten
		Alpha += Fw * FVector::DotProduct(FVector::CrossProduct(Up, Z), Fw) * 6.f;
		Alpha -= Omega * 2.2f;
	}

	if (!Alpha.IsNearlyZero())
	{
		Frame->AddTorqueInRadians(Alpha, NAME_None, true);
	}

	// Pop / Bunny-Hop: Beine strecken nach dem Tiefgehen
	if (bPrevCrouch && !Input.bCrouch && Grounded > 0.f && CrouchTime > 0.12f)
	{
		const float Depth = FMath::Clamp(-RiderOffsetM.Z / 0.2f, 0.f, 1.f);
		Frame->AddImpulse(Up * (1.0f + 1.7f * Depth) * 100.f, NAME_None, true);
		RiderVelM.Z += 2.2f;
	}
	CrouchTime = Input.bCrouch ? CrouchTime + Dt : 0.f;
	bPrevCrouch = Input.bCrouch;
}

// -----------------------------------------------------------------------------
// Fahrerkoerper als Masse-Feder: die Beine federn ab, was der Rahmen wirklich erlebt
// -----------------------------------------------------------------------------
void AKWBike::UpdateRiderDynamics(float Dt)
{
	const FVector V = Frame->GetPhysicsLinearVelocity() / 100.f;
	FVector Accel = (V - PrevVelocityMS) / Dt;
	PrevVelocityMS = V;
	Accel = Accel.GetClampedToMaxSize(90.f);
	SmoothedAccel = FMath::Lerp(SmoothedAccel, Accel, 1.f - FMath::Exp(-Dt * 35.f));

	// spezifische Kraft (was der Fahrer "spuert"): Schwerkraft minus Beschleunigung des Bikes
	const FVector SpecW = FVector(0.f, 0.f, -Gravity) - SmoothedAccel;
	const FVector Spec = Frame->GetComponentTransform().InverseTransformVectorNoScale(SpecW);

	const FVector K(120.f, 220.f, 190.f);    // Steifigkeit der Beine/Arme je Achse (1/s^2)
	const FVector C(14.f, 20.f, 16.5f);      // Daempfung (Muskeln)
	FVector Rest(0.f, 0.f, Gravity / K.Z);   // so dass im Stand die neutrale Haltung herauskommt
	Rest.Z -= Input.bCrouch ? 0.17f : 0.f;
	Rest.X += 0.07f * Input.Pitch - 0.04f * Input.Brake - 0.03f;
	if (IsCrashed())
	{
		Rest = FVector(0.12f, 0.f, -0.22f);
	}

	const int32 Steps = 4;
	const float H = Dt / Steps;
	for (int32 i = 0; i < Steps; ++i)
	{
		const FVector A = K * (Rest - RiderOffsetM) - C * RiderVelM + Spec;
		RiderVelM += A * H;
		RiderOffsetM += RiderVelM * H;
		auto ClampAxis = [this](int32 Axis, float Lo, float Hi)
		{
			if (RiderOffsetM[Axis] < Lo) { RiderOffsetM[Axis] = Lo; RiderVelM[Axis] = FMath::Max(RiderVelM[Axis], 0.f); }
			if (RiderOffsetM[Axis] > Hi) { RiderOffsetM[Axis] = Hi; RiderVelM[Axis] = FMath::Min(RiderVelM[Axis], 0.f); }
		};
		ClampAxis(0, -0.22f, 0.14f);
		ClampAxis(1, -0.08f, 0.08f);
		ClampAxis(2, -0.27f, 0.09f);
	}
}

// -----------------------------------------------------------------------------
void AKWBike::CheckCrash(float Dt)
{
	if (IsCrashed() || bFrozen) return;
	const FTransform& T = Frame->GetComponentTransform();
	const FVector Up = T.GetUnitAxis(EAxis::Z);
	const FVector Fw = T.GetUnitAxis(EAxis::X);
	const bool bGround = Front.bContact || Rear.bContact;

	if (bGround && Up.Z < 0.42f)
	{
		StartCrash(TEXT("Weggerutscht!"));
		return;
	}
	if (bGround && AirTime == 0.f && !PreLandingVel.IsNearlyZero())
	{
		// gerade gelandet
		const FVector N = Rear.bContact ? Rear.ContactNormal : Front.ContactNormal;
		const float VInto = FVector::DotProduct(PreLandingVel, N);
		const FVector Vh = FVector(PreLandingVel.X, PreLandingVel.Y, 0.f).GetSafeNormal();
		const FVector Fh = FVector(Fw.X, Fw.Y, 0.f).GetSafeNormal();
		const float CrossAngle = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(FVector::DotProduct(Vh, Fh), -1.f, 1.f)));
		const float LandSpeed = PreLandingVel.Size();
		PreLandingVel = FVector::ZeroVector;
		if (VInto < -9.5f) { StartCrash(TEXT("Zu hart gelandet!")); return; }
		if (CrossAngle > 55.f && LandSpeed > 4.f) { StartCrash(TEXT("Quer gelandet!")); return; }
		if (Front.bContact && !Rear.bContact && FVector::DotProduct(Fw, N) < -0.55f) { StartCrash(TEXT("Ueber den Lenker!")); return; }
	}

	// weit neben der Strecke oder unter dem Gelaende
	if (LateralOffsetM > 45.f) OffTrackTimer += Dt; else OffTrackTimer = 0.f;
	if (OffTrackTimer > 2.5f || GetActorLocation().Z < -20000.f)
	{
		ResetToTrack(2.f);
	}
}

void AKWBike::StartCrash(const TCHAR* Reason)
{
	CrashTimer = 2.6f;
	LastTrick = Reason;
	TrickTimer = 2.6f;
	// Bike kippt und rutscht weiter - Physik uebernimmt
	const FVector Fw = Frame->GetForwardVector();
	Frame->AddAngularImpulseInRadians(Fw * FMath::RandRange(-3.f, 3.f), NAME_None, true);
}

void AKWBike::OnFrameHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit)
{
	// Impuls in N*s (UE: kg*cm/s). 92 kg * ~4 m/s Aufprall = Sturz (z. B. Baum, Durchschlag ins Gelaende)
	if (!IsCrashed() && !bFrozen && NormalImpulse.Size() / 100.f > 360.f)
	{
		StartCrash(Cast<APawn>(OtherActor) ? TEXT("Zusammengestossen!") : TEXT("Eingeschlagen!"));
	}
}

void AKWBike::ResetToTrack(float BackM)
{
	AKWTrack* Track = GetTrack();
	CrashTimer = 0.f;
	OffTrackTimer = 0.f;
	RiderOffsetM = RiderVelM = FVector::ZeroVector;
	Front.CompressionCm = Front.PrevCompressionCm = Rear.CompressionCm = Rear.PrevCompressionCm = 0.f;
	AirTime = 0.f;
	PreLandingVel = FVector::ZeroVector;
	if (!Track) return;

	const float D = FMath::Clamp(RaceDistanceM - BackM, 2.f, Track->GetLengthM() - 2.f);
	const FVector Dir = Track->GetDirectionAtM(D);
	const FVector Loc = Track->GetLocationAtM(D) + Track->GetRightAtM(D) * (AILane * 80.f) + FVector(0, 0, 70.f);
	const FRotator Rot = FRotationMatrix::MakeFromXZ(Dir, FVector::UpVector).Rotator();
	SetActorLocationAndRotation(Loc, Rot, false, nullptr, ETeleportType::TeleportPhysics);
	Frame->SetPhysicsLinearVelocity(Dir * 300.f);
	Frame->SetPhysicsAngularVelocityInRadians(FVector::ZeroVector);
	PrevVelocityMS = Dir * 3.f;
	SmoothedAccel = FVector::ZeroVector;
	CamRot = FRotator(-14.f, Rot.Yaw, 0.f);
}

// -----------------------------------------------------------------------------
// KI: folgt der Ideallinie mit Vorausschau, bremst vor Kurven
// -----------------------------------------------------------------------------
void AKWBike::ComputeAIInput(float Dt)
{
	AKWTrack* Track = GetTrack();
	if (!Track) return;

	const FTransform& T = Frame->GetComponentTransform();
	const float V = Frame->GetPhysicsLinearVelocity().Size() / 100.f;
	const float D = RaceDistanceM;
	const float Look = 5.f + 0.75f * V;
	const FVector Target = Track->GetLocationAtM(D + Look) + Track->GetRightAtM(D + Look) * (AILane * 100.f);
	const FVector Local = T.InverseTransformPositionNoScale(Target);
	const float Angle = FMath::Atan2(Local.Y, Local.X);
	const float YawRate = FVector::DotProduct(Frame->GetPhysicsAngularVelocityInRadians(), FVector::UpVector);

	FKWBikeInput AI;
	AI.Steer = FMath::Clamp(Angle * 1.8f - YawRate * 0.15f, -1.f, 1.f);

	const float Kappa = Track->GetCurvatureAheadM(D + 2.f, 22.f + V);
	float VMax = FMath::Sqrt(0.85f * Gravity / FMath::Max(Kappa, 0.004f)) * (0.74f + 0.14f * AISkill);
	VMax = FMath::Min(VMax, 12.5f + 5.f * AISkill);
	if (V > VMax + 0.3f) AI.Brake = FMath::Clamp((V - VMax) / 2.5f, 0.f, 1.f);
	else if (V < VMax - 1.5f) AI.Pedal = 1.f;
	Input = AI;
}

// -----------------------------------------------------------------------------
// Optik: Raeder, Gabel, Hinterbau, Kurbel
// -----------------------------------------------------------------------------
void AKWBike::UpdateBikeVisual(float Dt)
{
	const FVector SteerAxis = (-Front.Dir).GetSafeNormal();
	const FQuat SteerQ(SteerAxis, SteerAngleRad);
	const FVector Crown = Front.ExtendedAxle - Front.Dir * (Front.TravelCm + 38.f);
	auto Steered = [&](const FVector& P) { return Crown + SteerQ.RotateVector(P - Crown); };

	// Raeder
	FrontPivot->SetRelativeLocationAndRotation(Steered(Front.AxleLocal()), SteerQ * FQuat(FVector::RightVector, ToRad(Front.SpinDeg)));
	RearPivot->SetRelativeLocationAndRotation(Rear.AxleLocal(), FQuat(FVector::RightVector, ToRad(Rear.SpinDeg)));

	// Gabel: Standrohre fest an der Krone, Tauchrohre an der Achse -> man sieht den Federweg arbeiten
	const FVector Axle = Front.AxleLocal();
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		const FVector Off(0.f, Side * 8.5f, 0.f);
		const FVector UpperA = Crown + Off;
		const FVector UpperB = Crown + Off + Front.Dir * 46.f;
		const FVector LowerA = Axle + Off;
		const FVector LowerB = Axle + Off - Front.Dir * 36.f;
		KWShapes::PlaceBetween(Side < 0 ? ForkUpperL : ForkUpperR, Steered(UpperA), Steered(UpperB), 1.8f);
		KWShapes::PlaceBetween(Side < 0 ? ForkLowerL : ForkLowerR, Steered(LowerA), Steered(LowerB), 2.3f);
	}
	ForkCrown->SetRelativeTransform(FTransform(SteerQ * FRotationMatrix::MakeFromZX(-Front.Dir, FVector::ForwardVector).ToQuat(), Steered(Crown), FVector(0.06f, 0.21f, 0.04f)));

	const FVector HTTop = Crown - Front.Dir * 14.f;
	const FVector BarC = HTTop - Front.Dir * 4.f + FVector(4.f, 0.f, 6.f);
	Stem->SetRelativeTransform(FTransform(SteerQ.Rotator(), Steered((HTTop + BarC) * 0.5f), FVector(0.08f, 0.05f, 0.08f)));
	KWShapes::PlaceBetween(Bar, Steered(BarC + FVector(0, -39.f, 1.5f)), Steered(BarC + FVector(0, 39.f, 1.5f)), 1.6f);

	// Hinterbau: Schwinge um den Hauptdrehpunkt, Daempfer zwischen Rahmen und Wippe
	const FVector RAxle = Rear.AxleLocal();
	KWShapes::PlaceBetween(SwingArm, SwingPivot, RAxle, 2.6f, 3.2f);
	const FVector Rocker = B(-9.f, 0.f, 33.f) + (RAxle - Rear.ExtendedAxle) * 0.35f;
	KWShapes::PlaceBetween(SeatStay, RAxle, Rocker, 1.8f);
	const FVector ShockFront = B(14.f, 0.f, 20.f);
	KWShapes::PlaceBetween(ShockBody, ShockFront, FMath::Lerp(ShockFront, Rocker, 0.55f), 2.4f);
	KWShapes::PlaceBetween(ShockSpring, FMath::Lerp(ShockFront, Rocker, 0.35f), Rocker, 3.0f);

	// Kurbel: beim Treten drehen, sonst Pedale waagerecht (typische Abfahrtshaltung)
	const float RearSpeed = FVector::DotProduct(Frame->GetPhysicsLinearVelocity(), Frame->GetForwardVector()) / 100.f;
	if (Input.Pedal > 0.05f && !IsAirborne())
	{
		CrankAngle -= FMath::Max(RearSpeed, 1.5f) / (WheelRadiusCm / 100.f) / 1.6f * Dt;
	}
	else
	{
		const float Level = FMath::RoundToFloat(CrankAngle / PI) * PI;
		CrankAngle = FMath::FInterpTo(CrankAngle, Level, Dt, 6.f);
	}
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		const float A = CrankAngle + (Side < 0 ? PI : 0.f);
		const FVector Pedal = BB + FVector(FMath::Cos(A) * CrankCm, Side * 9.f, FMath::Sin(A) * CrankCm);
		KWShapes::PlaceBetween(Side < 0 ? CrankL : CrankR, BB + FVector(0, Side * 7.f, 0), Pedal, 1.6f, 1.2f);
		(Side < 0 ? PedalL : PedalR)->SetRelativeTransform(KWShapes::Box(Pedal + FVector(0, Side * 4.f, 0), FVector(10.f, 9.f, 2.f)));
	}
}

// -----------------------------------------------------------------------------
// Fahrer: Huefte aus dem Masse-Feder-System, Fuesse auf den Pedalen, Haende am Lenker
// -----------------------------------------------------------------------------
void AKWBike::UpdateRiderRig()
{
	const FVector SteerAxis = (-Front.Dir).GetSafeNormal();
	const FQuat SteerQ(SteerAxis, SteerAngleRad);
	const FVector Crown = Front.ExtendedAxle - Front.Dir * (Front.TravelCm + 38.f);
	const FVector HTTop = Crown - Front.Dir * 14.f;
	const FVector BarC = HTTop - Front.Dir * 4.f + FVector(4.f, 0.f, 6.f);
	auto Steered = [&](const FVector& P) { return Crown + SteerQ.RotateVector(P - Crown); };

	const FVector Hip = HipNeutral + RiderOffsetM * 100.f;
	const float Drop = -RiderOffsetM.Z * 100.f;          // cm tiefer als neutral

	Pelvis->SetRelativeTransform(FTransform(FRotator::ZeroRotator, Hip, FVector(0.28f, 0.34f, 0.24f)));

	// Beine
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		const float A = CrankAngle + (Side < 0 ? PI : 0.f);
		const FVector Pedal = BB + FVector(FMath::Cos(A) * CrankCm, Side * 13.f, FMath::Sin(A) * CrankCm);
		FVector Ankle = Pedal + FVector(-3.f, 0.f, 7.f);
		const FVector HipSide = Hip + FVector(0.f, Side * 10.f, -2.f);
		const FVector Knee = SolveJoint(HipSide, Ankle, ThighCm, ShinCm, FVector(1.f, Side * 0.18f, 0.25f));
		KWShapes::PlaceBetween(Side < 0 ? ThighL : ThighR, HipSide, Knee, 7.6f);
		KWShapes::PlaceBetween(Side < 0 ? ShinL : ShinR, Knee, Ankle, 5.6f);
		(Side < 0 ? KneePadL : KneePadR)->SetRelativeTransform(FTransform(FRotator::ZeroRotator, Knee + FVector(2.f, 0, 0), FVector(0.14f, 0.13f, 0.15f)));
		(Side < 0 ? ShoeL : ShoeR)->SetRelativeTransform(KWShapes::Box(Ankle + FVector(4.f, 0.f, -5.f), FVector(27.f, 10.f, 8.f)));
	}

	// Oberkoerper: je tiefer, desto flacher; in der Luft leicht aufrecht
	float TorsoDeg = FMath::Clamp(44.f - Drop * 0.7f - Input.Pitch * 8.f, 12.f, 70.f);
	FVector ShoulderC = Hip + FVector(FMath::Cos(ToRad(TorsoDeg)), 0.f, FMath::Sin(ToRad(TorsoDeg))) * TorsoCm;

	// Arme muessen den Lenker erreichen: Schultern ggf. Richtung Lenker ziehen
	const FVector GripL = Steered(BarC + FVector(0.f, -34.f, 2.f));
	const FVector GripR = Steered(BarC + FVector(0.f, 34.f, 2.f));
	const float ArmMax = (UpperArmCm + ForeArmCm) * 0.97f;
	for (int32 Iter = 0; Iter < 2; ++Iter)
	{
		const FVector SL = ShoulderC + FVector(0, -19.f, 0), SR = ShoulderC + FVector(0, 19.f, 0);
		const float Excess = FMath::Max((GripL - SL).Size(), (GripR - SR).Size()) - ArmMax;
		if (Excess <= 0.f) break;
		ShoulderC += (((GripL + GripR) * 0.5f) - ShoulderC).GetSafeNormal() * Excess;
	}

	KWShapes::PlaceBetween(Torso, Hip + FVector(0, 0, 4.f), ShoulderC - FVector(2.f, 0, 3.f), 15.5f, 18.f);
	const FVector Back = (ShoulderC - Hip).GetSafeNormal();
	const FVector BackNormal = FVector::CrossProduct(FVector::RightVector, Back).GetSafeNormal();
	Backpack->SetRelativeTransform(FTransform(FRotationMatrix::MakeFromZX(Back, BackNormal).ToQuat(), FMath::Lerp(Hip, ShoulderC, 0.55f) - BackNormal * 14.f, FVector(0.08f, 0.24f, 0.32f)));

	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		const FVector Shoulder = ShoulderC + FVector(0.f, Side * 19.f, 0.f);
		FVector Hand = Side < 0 ? GripL : GripR;
		const FVector Elbow = SolveJoint(Shoulder, Hand, UpperArmCm, ForeArmCm, FVector(-0.3f, Side * 1.f, -0.4f));
		KWShapes::PlaceBetween(Side < 0 ? UpperArmL : UpperArmR, Shoulder, Elbow, 5.2f);
		KWShapes::PlaceBetween(Side < 0 ? ForeArmL : ForeArmR, Elbow, Hand, 4.4f);
		(Side < 0 ? HandL : HandR)->SetRelativeTransform(FTransform(FRotator::ZeroRotator, Hand, FVector(0.1f, 0.09f, 0.09f)));
	}

	// Kopf: schaut nach vorn auf den Trail
	const FVector HeadC = ShoulderC + FVector(9.f, 0.f, 17.f);
	KWShapes::PlaceBetween(Neck, ShoulderC, HeadC, 5.f);
	Head->SetRelativeTransform(FTransform(FRotator::ZeroRotator, HeadC, FVector(0.2f, 0.18f, 0.22f)));
	Helmet->SetRelativeTransform(FTransform(FRotator(-8.f, 0, 0), HeadC + FVector(-1.f, 0, 2.5f), FVector(0.29f, 0.26f, 0.27f)));
	ChinBar->SetRelativeTransform(KWShapes::Box(HeadC + FVector(11.f, 0.f, -8.f), FVector(8.f, 18.f, 7.f), FRotator(20.f, 0, 0)));
	Goggles->SetRelativeTransform(KWShapes::Box(HeadC + FVector(12.f, 0.f, 2.f), FVector(4.f, 20.f, 6.f)));
	Peak->SetRelativeTransform(KWShapes::Box(HeadC + FVector(13.f, 0.f, 11.f), FVector(12.f, 20.f, 1.5f), FRotator(12.f, 0, 0)));

	if (bHelmetCam)
	{
		HelmetCam->SetRelativeLocationAndRotation(HeadC + FVector(14.f, 0.f, 3.f), FRotator(-10.f, 0.f, 0.f));
	}
}

// -----------------------------------------------------------------------------
void AKWBike::UpdateCamera(float Dt)
{
	const FVector V = Frame->GetPhysicsLinearVelocity();
	const float Yaw = V.Size2D() > 200.f ? V.Rotation().Yaw : GetActorRotation().Yaw;
	const FRotator Target(-13.f, Yaw, 0.f);
	CamRot = FMath::RInterpTo(CamRot, Target, Dt, IsCrashed() ? 1.f : 4.f);
	CamArm->SetWorldRotation(CamRot);
	CamArm->TargetArmLength = FMath::FInterpTo(CamArm->TargetArmLength, IsCrashed() ? 700.f : 420.f + V.Size() * 0.04f, Dt, 2.f);
}
