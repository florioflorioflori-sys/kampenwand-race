#include "KWForest.h"
#include "KWWorldData.h"
#include "KWShapes.h"
#include "Engine/StaticMesh.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"

AKWForest::AKWForest()
{
	PrimaryActorTick.bCanEverTick = false;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

UHierarchicalInstancedStaticMeshComponent* AKWForest::MakeHISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bCollision, float CullCm)
{
	UHierarchicalInstancedStaticMeshComponent* C = NewObject<UHierarchicalInstancedStaticMeshComponent>(this, Name);
	C->SetStaticMesh(Mesh);
	C->SetMaterial(0, KWShapes::Color(this, Color));
	C->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
	if (bCollision) C->SetCollisionProfileName(TEXT("BlockAll"));
	if (CullCm > 0.f) C->SetCullDistances(0, (int32)CullCm);
	C->SetupAttachment(RootComponent);
	C->RegisterComponent();
	Parts.Add(C);
	return C;
}

void AKWForest::Build(const FKWWorldData& Data)
{
	// --- Baeume ---
	UHierarchicalInstancedStaticMeshComponent* TrunkNear = MakeHISM(TEXT("TrunkNear"), KWShapes::Cylinder(), FLinearColor(0.16f, 0.1f, 0.06f), true);
	UHierarchicalInstancedStaticMeshComponent* TrunkFar = MakeHISM(TEXT("TrunkFar"), KWShapes::Cylinder(), FLinearColor(0.16f, 0.1f, 0.06f), false, 120000.f);
	UHierarchicalInstancedStaticMeshComponent* Spruce1 = MakeHISM(TEXT("SpruceLow"), KWShapes::Cone(), FLinearColor(0.035f, 0.11f, 0.05f), false);
	UHierarchicalInstancedStaticMeshComponent* Spruce2 = MakeHISM(TEXT("SpruceMid"), KWShapes::Cone(), FLinearColor(0.045f, 0.13f, 0.055f), false);
	UHierarchicalInstancedStaticMeshComponent* Spruce3 = MakeHISM(TEXT("SpruceTop"), KWShapes::Cone(), FLinearColor(0.05f, 0.15f, 0.06f), false, 200000.f);
	UHierarchicalInstancedStaticMeshComponent* Beech = MakeHISM(TEXT("BeechCrown"), KWShapes::Sphere(), FLinearColor(0.12f, 0.24f, 0.05f), false);
	UHierarchicalInstancedStaticMeshComponent* Beech2 = MakeHISM(TEXT("BeechCrown2"), KWShapes::Sphere(), FLinearColor(0.16f, 0.28f, 0.06f), false, 150000.f);

	// Abstand zur Strecke grob pruefen: Baeume nahe der Strecke bekommen Kollision (Sturz bei Kontakt)
	auto NearTrack = [&Data](const FVector& P)
	{
		for (int32 i = 0; i < Data.Track.Num(); i += 3)
		{
			if (FVector::DistSquared2D(Data.Track[i], P) < FMath::Square(3500.f)) return true;
		}
		return false;
	};

	TArray<FTransform> TN, TF, S1, S2, S3, B1, B2;
	for (const FKWTree& T : Data.Trees)
	{
		const float Sc = T.Scale;
		const FRotator Yaw(0.f, T.YawDeg, 0.f);
		const FVector P = T.Pos;
		const bool bNear = NearTrack(P);
		if (T.Kind == 0)
		{
			// Fichte ~ 20-30 m: Stamm + drei gestaffelte Kegel
			const float H = 2400.f * Sc;
			(bNear ? TN : TF).Add(FTransform(Yaw, P + FVector(0, 0, H * 0.25f), FVector(0.5f * Sc, 0.5f * Sc, H * 0.5f / 100.f)));
			S1.Add(FTransform(Yaw, P + FVector(0, 0, H * 0.36f), FVector(6.4f * Sc, 6.4f * Sc, H * 0.5f / 100.f)));
			S2.Add(FTransform(Yaw, P + FVector(0, 0, H * 0.58f), FVector(4.6f * Sc, 4.6f * Sc, H * 0.42f / 100.f)));
			S3.Add(FTransform(Yaw, P + FVector(0, 0, H * 0.8f), FVector(2.6f * Sc, 2.6f * Sc, H * 0.36f / 100.f)));
		}
		else
		{
			// Buche ~ 18-25 m: Stamm + zwei Kronenkugeln
			const float H = 2000.f * Sc;
			(bNear ? TN : TF).Add(FTransform(Yaw, P + FVector(0, 0, H * 0.3f), FVector(0.7f * Sc, 0.7f * Sc, H * 0.6f / 100.f)));
			B1.Add(FTransform(Yaw, P + FVector(0, 0, H * 0.68f), FVector(9.f * Sc, 8.f * Sc, 8.f * Sc)));
			B2.Add(FTransform(Yaw, P + FVector(250.f * Sc, -150.f * Sc, H * 0.82f), FVector(6.f * Sc, 6.f * Sc, 5.5f * Sc)));
		}
	}
	TrunkNear->AddInstances(TN, false);
	TrunkFar->AddInstances(TF, false);
	Spruce1->AddInstances(S1, false);
	Spruce2->AddInstances(S2, false);
	Spruce3->AddInstances(S3, false);
	Beech->AddInstances(B1, false);
	Beech2->AddInstances(B2, false);

	// --- Zuschauer ---
	const FLinearColor Shirts[5] = {
		FLinearColor(0.75f, 0.06f, 0.05f), FLinearColor(0.05f, 0.2f, 0.6f), FLinearColor(0.85f, 0.75f, 0.1f),
		FLinearColor(0.1f, 0.45f, 0.15f), FLinearColor(0.9f, 0.9f, 0.9f) };
	UHierarchicalInstancedStaticMeshComponent* Shirt[5];
	for (int32 i = 0; i < 5; ++i) Shirt[i] = MakeHISM(*FString::Printf(TEXT("SpectatorShirt%d"), i), KWShapes::Cylinder(), Shirts[i], false, 40000.f);
	UHierarchicalInstancedStaticMeshComponent* Legs = MakeHISM(TEXT("SpectatorLegs"), KWShapes::Cylinder(), FLinearColor(0.12f, 0.1f, 0.08f), false, 40000.f);
	UHierarchicalInstancedStaticMeshComponent* Heads = MakeHISM(TEXT("SpectatorHeads"), KWShapes::Sphere(), FLinearColor(0.72f, 0.5f, 0.38f), false, 40000.f);
	UHierarchicalInstancedStaticMeshComponent* Hats = MakeHISM(TEXT("SpectatorHats"), KWShapes::Cylinder(), FLinearColor(0.15f, 0.25f, 0.12f), false, 40000.f);

	int32 Idx = 0;
	for (const FKWSpectator& S : Data.Spectators)
	{
		const FRotator R(0.f, S.YawDeg, 0.f);
		const FTransform Base(R, S.Pos);
		const float Hgt = 0.92f + 0.12f * ((Idx * 37) % 10) / 10.f;
		auto L = [&](const FVector& Local) { return Base.TransformPosition(Local * Hgt); };
		Legs->AddInstance(KWShapes::Between(L(FVector(0, -9, 0)), L(FVector(0, -9, 90)), 6.5f));
		Legs->AddInstance(KWShapes::Between(L(FVector(0, 9, 0)), L(FVector(0, 9, 90)), 6.5f));
		UHierarchicalInstancedStaticMeshComponent* Sh = Shirt[Idx % 5];
		Sh->AddInstance(KWShapes::Between(L(FVector(0, 0, 85)), L(FVector(0, 0, 150)), 17.f, 13.f));
		// jeder dritte jubelt mit erhobenen Armen
		const bool bCheer = (Idx % 3) == 0;
		for (int32 Side = -1; Side <= 1; Side += 2)
		{
			const FVector Sh0 = L(FVector(0, Side * 20.f, 145));
			const FVector Hand = bCheer ? L(FVector(10, Side * 32.f, 200)) : L(FVector(5, Side * 24.f, 95));
			Sh->AddInstance(KWShapes::Between(Sh0, Hand, 4.5f));
		}
		Heads->AddInstance(FTransform(R, L(FVector(0, 0, 165)), FVector(0.22f * Hgt)));
		if (Idx % 4 == 1)
		{
			Hats->AddInstance(KWShapes::Between(L(FVector(0, 0, 172)), L(FVector(0, 0, 182)), 13.f)); // Trachtenhut
		}
		++Idx;
	}
}
