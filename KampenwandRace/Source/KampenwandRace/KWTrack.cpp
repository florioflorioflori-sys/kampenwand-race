#include "KWTrack.h"
#include "KWWorldData.h"
#include "KWShapes.h"
#include "Components/SplineComponent.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/World.h"
#include "Engine/StaticMesh.h"

AKWTrack::AKWTrack()
{
	PrimaryActorTick.bCanEverTick = false;
	Spline = CreateDefaultSubobject<USplineComponent>(TEXT("Spline"));
	RootComponent = Spline;
}

UHierarchicalInstancedStaticMeshComponent* AKWTrack::MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bCollision)
{
	UHierarchicalInstancedStaticMeshComponent* C = NewObject<UHierarchicalInstancedStaticMeshComponent>(this, Name);
	C->SetStaticMesh(Mesh);
	C->SetMaterial(0, KWShapes::Color(this, Color));
	C->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	if (bCollision) C->SetCollisionProfileName(TEXT("BlockAll"));
	C->SetupAttachment(RootComponent);
	C->RegisterComponent();
	ISMs.Add(C);
	return C;
}

FVector AKWTrack::GroundAt(const FVector& P) const
{
	FHitResult Hit;
	FCollisionQueryParams Params(SCENE_QUERY_STAT(KWGround), false, this);
	if (GetWorld()->LineTraceSingleByChannel(Hit, P + FVector(0, 0, 3000.f), P - FVector(0, 0, 3000.f), ECC_Visibility, Params))
	{
		return Hit.ImpactPoint;
	}
	return P;
}

void AKWTrack::Build(const FKWWorldData& Data)
{
	Spline->ClearSplinePoints(false);
	for (const FVector& P : Data.Track)
	{
		Spline->AddSplinePoint(P, ESplineCoordinateSpace::World, false);
	}
	Spline->UpdateSpline();

	const float L = GetLengthM();

	// --- Absperrband mit Pfosten (rot/weiss), beidseitig ---
	UHierarchicalInstancedStaticMeshComponent* Posts = MakeISM(TEXT("TapePosts"), KWShapes::Cylinder(), FLinearColor(0.85f, 0.82f, 0.7f), false);
	UHierarchicalInstancedStaticMeshComponent* TapeRed = MakeISM(TEXT("TapeRed"), KWShapes::Cube(), FLinearColor(0.8f, 0.03f, 0.02f), false);
	UHierarchicalInstancedStaticMeshComponent* TapeWhite = MakeISM(TEXT("TapeWhite"), KWShapes::Cube(), FLinearColor(0.9f, 0.9f, 0.9f), false);
	const float Spacing = 7.f;
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		FVector Prev = FVector::ZeroVector;
		int32 Count = 0;
		for (float D = 15.f; D < L - 5.f; D += Spacing, ++Count)
		{
			const FVector P = GroundAt(GetLocationAtM(D) + GetRightAtM(D) * (Side * 330.f));
			Posts->AddInstance(KWShapes::Between(P - FVector(0, 0, 20.f), P + FVector(0, 0, 105.f), 2.2f));
			const FVector Top = P + FVector(0, 0, 95.f);
			if (Count > 0 && FVector::Dist(Prev, Top) < Spacing * 180.f)
			{
				const FVector Dir = (Top - Prev).GetSafeNormal();
				const FTransform T(FRotationMatrix::MakeFromXZ(Dir, FVector::UpVector).Rotator(), (Prev + Top) * 0.5f, FVector(FVector::Dist(Prev, Top) / 100.f, 0.004f, 0.05f));
				(Count % 2 ? TapeRed : TapeWhite)->AddInstance(T);
			}
			Prev = Top;
		}
	}

	// --- Kicker aus Holz ---
	UHierarchicalInstancedStaticMeshComponent* Kickers = MakeISM(TEXT("Kickers"), KWShapes::Cube(), FLinearColor(0.42f, 0.27f, 0.13f), true);
	UHierarchicalInstancedStaticMeshComponent* Planks = MakeISM(TEXT("KickerPlanks"), KWShapes::Cube(), FLinearColor(0.55f, 0.38f, 0.2f), false);
	for (const FKWJump& J : Data.Jumps)
	{
		const float Thick = 100.f;
		const FVector A = GroundAt(GetLocationAtM(J.DistM - 2.1f));
		const FVector Bt = GroundAt(GetLocationAtM(J.DistM + 2.1f)) + FVector(0, 0, J.HeightCm);
		const FVector Dir = (Bt - A).GetSafeNormal();
		const FVector Right = GetRightAtM(J.DistM);
		const FVector Up = FVector::CrossProduct(Dir, Right).GetSafeNormal() * -1.f;
		const FVector UpFixed = FVector::DotProduct(Up, FVector::UpVector) < 0 ? -Up : Up;
		const FRotator R = FRotationMatrix::MakeFromXZ(Dir, UpFixed).Rotator();
		const FVector Center = (A + Bt) * 0.5f - UpFixed * (Thick * 0.5f);
		Kickers->AddInstance(FTransform(R, Center, FVector(FVector::Dist(A, Bt) / 100.f, 2.6f, Thick / 100.f)));
		// Bretter-Optik auf der Oberseite
		for (int32 i = 0; i < 7; ++i)
		{
			const FVector P = FMath::Lerp(A, Bt, (i + 0.5f) / 7.f) + UpFixed * 0.6f;
			Planks->AddInstance(FTransform(R, P, FVector(0.5f, 2.62f, 0.012f)));
		}
	}

	BuildGate(4.f, TEXT("START KAMPENWAND"), FLinearColor(0.05f, 0.25f, 0.65f));
	BuildGate(L - 3.f, TEXT("ZIEL ASCHAU"), FLinearColor(0.75f, 0.05f, 0.05f));
}

void AKWTrack::BuildGate(float DistM, const FString& Text, const FLinearColor& Color)
{
	UHierarchicalInstancedStaticMeshComponent* Gate = MakeISM(*FString::Printf(TEXT("Gate_%d"), (int32)DistM), KWShapes::Cube(), Color, true);
	const FVector C = GetLocationAtM(DistM);
	const FVector Right = GetRightAtM(DistM);
	const FVector Dir = GetDirectionAtM(DistM);
	const FRotator R = FRotationMatrix::MakeFromXZ(FVector(Dir.X, Dir.Y, 0).GetSafeNormal(), FVector::UpVector).Rotator();
	const FVector PL = GroundAt(C - Right * 420.f), PR = GroundAt(C + Right * 420.f);
	const float TopZ = FMath::Max(PL.Z, PR.Z) + 450.f;
	Gate->AddInstance(KWShapes::Between(PL - FVector(0, 0, 50), FVector(PL.X, PL.Y, TopZ), 25.f));
	Gate->AddInstance(KWShapes::Between(PR - FVector(0, 0, 50), FVector(PR.X, PR.Y, TopZ), 25.f));
	const FVector BannerC = FVector((PL.X + PR.X) * 0.5f, (PL.Y + PR.Y) * 0.5f, TopZ - 40.f);
	Gate->AddInstance(FTransform(R, BannerC, FVector(0.3f, 9.2f, 1.2f)));

	for (int32 Face = -1; Face <= 1; Face += 2)
	{
		UTextRenderComponent* T = NewObject<UTextRenderComponent>(this);
		T->SetupAttachment(RootComponent);
		T->RegisterComponent();
		T->SetText(FText::FromString(Text));
		T->SetHorizontalAlignment(EHTA_Center);
		T->SetVerticalAlignment(EVRTA_TextCenter);
		T->SetWorldSize(70.f);
		T->SetTextRenderColor(FColor::White);
		// Text zeigt jeweils zur Fahrtrichtung hin bzw. von ihr weg
		const FRotator TR = (Face < 0 ? R + FRotator(0, 180.f, 0) : R);
		T->SetWorldLocationAndRotation(BannerC + FRotationMatrix(R).GetUnitAxis(EAxis::X) * (Face * 17.f), TR);
		Texts.Add(T);
	}
}

float AKWTrack::GetLengthM() const
{
	return Spline->GetSplineLength() / 100.f;
}

float AKWTrack::GetDistanceM(const FVector& World, float* OutLateralM) const
{
	const float Key = Spline->FindInputKeyClosestToWorldLocation(World);
	if (OutLateralM)
	{
		const FVector C = Spline->GetLocationAtSplineInputKey(Key, ESplineCoordinateSpace::World);
		*OutLateralM = FVector::Dist2D(C, World) / 100.f;
	}
	return Spline->GetDistanceAlongSplineAtSplineInputKey(Key) / 100.f;
}

FVector AKWTrack::GetLocationAtM(float M) const
{
	return Spline->GetLocationAtDistanceAlongSpline(FMath::Clamp(M, 0.f, GetLengthM()) * 100.f, ESplineCoordinateSpace::World);
}

FVector AKWTrack::GetDirectionAtM(float M) const
{
	return Spline->GetDirectionAtDistanceAlongSpline(FMath::Clamp(M, 0.f, GetLengthM()) * 100.f, ESplineCoordinateSpace::World);
}

FVector AKWTrack::GetRightAtM(float M) const
{
	const FVector D = GetDirectionAtM(M);
	return FVector::CrossProduct(FVector::UpVector, FVector(D.X, D.Y, 0.f)).GetSafeNormal();
}

float AKWTrack::GetCurvatureAheadM(float FromM, float SpanM) const
{
	float MaxK = 0.f;
	const float Step = 5.f;
	for (float D = FromM; D < FromM + SpanM; D += Step)
	{
		const FVector A = GetDirectionAtM(D), Bv = GetDirectionAtM(D + Step);
		const FVector A2(A.X, A.Y, 0.f), B2(Bv.X, Bv.Y, 0.f);
		const float Ang = FMath::Acos(FMath::Clamp(FVector::DotProduct(A2.GetSafeNormal(), B2.GetSafeNormal()), -1.f, 1.f));
		MaxK = FMath::Max(MaxK, Ang / Step);
	}
	return MaxK;
}
