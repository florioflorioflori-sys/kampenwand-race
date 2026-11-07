#include "KWGondolaLift.h"
#include "KWWorldData.h"
#include "KWShapes.h"
#include "Engine/StaticMesh.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/TextRenderComponent.h"

namespace
{
	constexpr float HalfGaugeCm = 260.f;    // Seilabstand Berg-/Talfahrt
	constexpr float HangerCm = 320.f;
	constexpr float CabinH = 190.f;
}

AKWGondolaLift::AKWGondolaLift()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

UInstancedStaticMeshComponent* AKWGondolaLift::MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bMovable, bool bCollision)
{
	UInstancedStaticMeshComponent* C = NewObject<UInstancedStaticMeshComponent>(this, Name);
	C->SetStaticMesh(Mesh);
	C->SetMaterial(0, KWShapes::Color(this, Color));
	C->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	if (bCollision) C->SetCollisionProfileName(TEXT("BlockAll"));
	C->SetupAttachment(RootComponent);
	C->RegisterComponent();
	StaticParts.Add(C);
	return C;
}

void AKWGondolaLift::Build(const FKWWorldData& Data)
{
	const TArray<FKWSupport>& S = Data.Supports;
	if (S.Num() < 2) return;

	auto CableZ = [&](int32 i, int32 j, float t)
	{
		const float Span = FVector::Dist2D(S[i].Ground, S[j].Ground);
		return FMath::Lerp(S[i].CableZ, S[j].CableZ, t) - 4.f * Data.SagRatio * Span * t * (1.f - t);
	};

	// Querrichtung je Stuetze (Mittel der angrenzenden Spannfelder)
	TArray<FVector> Side;
	for (int32 i = 0; i < S.Num(); ++i)
	{
		FVector D = FVector::ZeroVector;
		if (i > 0) D += (S[i].Ground - S[i - 1].Ground).GetSafeNormal2D();
		if (i < S.Num() - 1) D += (S[i + 1].Ground - S[i].Ground).GetSafeNormal2D();
		D.Z = 0.f;
		Side.Add(FVector::CrossProduct(FVector::UpVector, D.GetSafeNormal()));
	}

	// Seillinie A (Bergstation -> Talstation, rechts) und B (zurueck, links)
	TArray<FVector> LineA, LineB;
	for (int32 i = 0; i < S.Num() - 1; ++i)
	{
		const float Span = FVector::Dist2D(S[i].Ground, S[i + 1].Ground);
		const int32 N = FMath::Max(2, FMath::CeilToInt(Span / 800.f));
		for (int32 k = 0; k < N; ++k)
		{
			const float t = (float)k / N;
			const FVector P2 = FMath::Lerp(S[i].Ground, S[i + 1].Ground, t);
			const FVector Sd = FMath::Lerp(Side[i], Side[i + 1], t).GetSafeNormal();
			const float Z = CableZ(i, i + 1, t);
			LineA.Add(FVector(P2.X, P2.Y, Z) + Sd * HalfGaugeCm);
			LineB.Add(FVector(P2.X, P2.Y, Z) - Sd * HalfGaugeCm);
		}
	}
	const FKWSupport& Last = S.Last();
	LineA.Add(FVector(Last.Ground.X, Last.Ground.Y, Last.CableZ) + Side.Last() * HalfGaugeCm);
	LineB.Add(FVector(Last.Ground.X, Last.Ground.Y, Last.CableZ) - Side.Last() * HalfGaugeCm);

	// Schleife: A hin, Umlenkung, B zurueck, Umlenkung
	Loop.Reset();
	Loop.Append(LineA);
	auto AddTurn = [&](const FVector& From, const FVector& To, const FVector& OutDir)
	{
		const FVector C = (From + To) * 0.5f;
		for (int32 k = 1; k < 8; ++k)
		{
			const float A = PI * k / 8.f;
			Loop.Add(C + (From - C) * FMath::Cos(A) + OutDir * HalfGaugeCm * FMath::Sin(A));
		}
	};
	AddTurn(LineA.Last(), LineB.Last(), (LineA.Last() - LineA[LineA.Num() - 2]).GetSafeNormal2D());
	for (int32 k = LineB.Num() - 1; k >= 0; --k) Loop.Add(LineB[k]);
	AddTurn(LineB[0], LineA[0], (LineB[0] - LineB[1]).GetSafeNormal2D());
	Loop.Add(Loop[0]);

	LoopDist.Reset();
	LoopDist.Add(0.f);
	for (int32 i = 1; i < Loop.Num(); ++i) LoopDist.Add(LoopDist.Last() + FVector::Dist(Loop[i - 1], Loop[i]));
	LoopLength = LoopDist.Last();

	// --- Seil ---
	UInstancedStaticMeshComponent* Cable = MakeISM(TEXT("Cable"), KWShapes::Cylinder(), FLinearColor(0.05f, 0.05f, 0.05f), false, false);
	for (int32 i = 1; i < Loop.Num(); ++i) Cable->AddInstance(KWShapes::Between(Loop[i - 1], Loop[i], 2.6f));
	Cable->SetCastShadow(false);

	// --- Stuetzen ---
	UInstancedStaticMeshComponent* Steel = MakeISM(TEXT("Steel"), KWShapes::Cylinder(), FLinearColor(0.42f, 0.44f, 0.46f), false, true);
	UInstancedStaticMeshComponent* SteelBox = MakeISM(TEXT("SteelBox"), KWShapes::Cube(), FLinearColor(0.42f, 0.44f, 0.46f), false, false);
	UInstancedStaticMeshComponent* Wheels = MakeISM(TEXT("Sheaves"), KWShapes::Cube(), FLinearColor(0.75f, 0.12f, 0.08f), false, false);
	for (int32 i = 1; i < S.Num() - 1; ++i)
	{
		const FVector G = S[i].Ground;
		const FVector Top(G.X, G.Y, S[i].CableZ);
		const FVector Fwd = FVector::CrossProduct(Side[i], FVector::UpVector);
		const FRotator R = FRotationMatrix::MakeFromXY(Fwd, Side[i]).Rotator();
		// leicht konischer Stahlmast mit Fundament
		Steel->AddInstance(KWShapes::Between(G - FVector(0, 0, 150.f), Top - FVector(0, 0, 120.f), 55.f));
		SteelBox->AddInstance(FTransform(R, G + FVector(0, 0, 40.f), FVector(1.8f, 1.8f, 1.2f)));
		SteelBox->AddInstance(FTransform(R, Top - FVector(0, 0, 110.f), FVector(0.6f, 7.0f, 0.5f)));     // Querjoch
		for (int32 Sd = -1; Sd <= 1; Sd += 2)
		{
			Wheels->AddInstance(FTransform(R, Top - FVector(0, 0, 40.f) + Side[i] * (Sd * HalfGaugeCm), FVector(3.2f, 0.25f, 0.5f)));  // Rollenbatterie
			SteelBox->AddInstance(FTransform(R, Top - FVector(0, 0, 80.f) + Side[i] * (Sd * HalfGaugeCm), FVector(0.25f, 0.25f, 0.8f)));
		}
	}

	// --- Stationen ---
	UInstancedStaticMeshComponent* Walls = MakeISM(TEXT("StationWalls"), KWShapes::Cube(), FLinearColor(0.82f, 0.78f, 0.7f), false, true);
	UInstancedStaticMeshComponent* Roofs = MakeISM(TEXT("StationRoofs"), KWShapes::Cube(), FLinearColor(0.25f, 0.13f, 0.08f), false, true);
	UInstancedStaticMeshComponent* Wood = MakeISM(TEXT("StationWood"), KWShapes::Cube(), FLinearColor(0.45f, 0.28f, 0.14f), false, false);
	for (int32 k = 0; k < 2; ++k)
	{
		const int32 i = k == 0 ? 0 : S.Num() - 1;
		const FVector G = S[i].Ground;
		const FVector Fwd = FVector::CrossProduct(Side[i], FVector::UpVector);
		const FRotator R = FRotationMatrix::MakeFromXY(Fwd, Side[i]).Rotator();
		const float H = S[i].CableZ - G.Z;
		const FVector Back = Fwd * (k == 0 ? 1.f : -1.f) * -600.f;  // Gebaeude hinter dem Seil-Einlauf
		Walls->AddInstance(FTransform(R, G + Back + FVector(0, 0, H * 0.5f - 200.f), FVector(16.f, 9.f, (H + 300.f) / 100.f)));
		Roofs->AddInstance(FTransform(R, G + Back + FVector(0, 0, H + 160.f), FVector(18.f, 11.f, 0.6f)));
		Wood->AddInstance(FTransform(R, G + Back + FVector(0, 0, H - 120.f), FVector(16.2f, 9.2f, 0.8f)));
		// Einfahrt (offene Halle ueber dem Seil)
		Roofs->AddInstance(FTransform(R, G + FVector(0, 0, H + 140.f), FVector(10.f, 9.f, 0.4f)));

		UTextRenderComponent* T = NewObject<UTextRenderComponent>(this);
		T->SetupAttachment(RootComponent);
		T->RegisterComponent();
		T->SetText(FText::FromString(k == 0 ? TEXT("KAMPENWANDBAHN  Bergstation") : TEXT("KAMPENWANDBAHN  Talstation")));
		T->SetHorizontalAlignment(EHTA_Center);
		T->SetWorldSize(90.f);
		T->SetTextRenderColor(FColor(240, 240, 230));
		T->SetWorldLocationAndRotation(G + Back + Side[i] * 455.f + FVector(0, 0, H - 40.f), FRotationMatrix::MakeFromXZ(Side[i], FVector::UpVector).Rotator());
	}

	// --- Kabinen ---
	CabinBody = MakeISM(TEXT("CabinBody"), KWShapes::Cube(), FLinearColor(0.72f, 0.05f, 0.04f), true, false);
	CabinGlass = MakeISM(TEXT("CabinGlass"), KWShapes::Cube(), FLinearColor(0.08f, 0.1f, 0.12f), true, false);
	CabinRoof = MakeISM(TEXT("CabinRoof"), KWShapes::Cube(), FLinearColor(0.85f, 0.85f, 0.85f), true, false);
	Hanger = MakeISM(TEXT("Hanger"), KWShapes::Cylinder(), FLinearColor(0.3f, 0.3f, 0.32f), true, false);
	NumCabins = FMath::Max(2, FMath::FloorToInt(LoopLength / (CabinSpacingM * 100.f)));
	for (int32 i = 0; i < NumCabins; ++i)
	{
		CabinBody->AddInstance(FTransform::Identity);
		CabinGlass->AddInstance(FTransform::Identity);
		CabinRoof->AddInstance(FTransform::Identity);
		Hanger->AddInstance(FTransform::Identity);
	}
	Tick(0.f);
}

FVector AKWGondolaLift::LoopPos(float U, FVector& OutDir) const
{
	U = FMath::Fmod(U, LoopLength);
	if (U < 0) U += LoopLength;
	int32 Lo = 0, Hi = LoopDist.Num() - 1;
	while (Hi - Lo > 1)
	{
		const int32 Mid = (Lo + Hi) / 2;
		if (LoopDist[Mid] <= U) Lo = Mid; else Hi = Mid;
	}
	const float Seg = FMath::Max(LoopDist[Hi] - LoopDist[Lo], 1.f);
	OutDir = (Loop[Hi] - Loop[Lo]).GetSafeNormal2D();
	return FMath::Lerp(Loop[Lo], Loop[Hi], (U - LoopDist[Lo]) / Seg);
}

void AKWGondolaLift::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (NumCabins == 0 || LoopLength <= 0.f) return;

	Offset += SpeedMS * 100.f * DeltaSeconds;
	TArray<FTransform> Body, Glass, Roof, Hang;
	Body.Reserve(NumCabins); Glass.Reserve(NumCabins); Roof.Reserve(NumCabins); Hang.Reserve(NumCabins);
	const float Spacing = LoopLength / NumCabins;
	for (int32 i = 0; i < NumCabins; ++i)
	{
		FVector Dir;
		const FVector P = LoopPos(Offset + i * Spacing, Dir);
		const FRotator R = FRotationMatrix::MakeFromXZ(Dir, FVector::UpVector).Rotator();
		const FVector C = P - FVector(0, 0, HangerCm + CabinH * 0.5f);
		Hang.Add(KWShapes::Between(P, P - FVector(0, 0, HangerCm), 3.5f));
		Body.Add(FTransform(R, C, FVector(1.55f, 1.35f, CabinH / 100.f)));
		Glass.Add(FTransform(R, C + FVector(0, 0, 35.f), FVector(1.58f, 1.38f, 0.6f)));
		Roof.Add(FTransform(R, C + FVector(0, 0, CabinH * 0.5f + 8.f), FVector(1.45f, 1.25f, 0.16f)));
	}
	CabinBody->BatchUpdateInstancesTransforms(0, Body, true, true, true);
	CabinGlass->BatchUpdateInstancesTransforms(0, Glass, true, true, true);
	CabinRoof->BatchUpdateInstancesTransforms(0, Roof, true, true, true);
	Hanger->BatchUpdateInstancesTransforms(0, Hang, true, true, true);
}
