#include "KWGameMode.h"
#include "KWBike.h"
#include "KWTrack.h"
#include "KWGondolaLift.h"
#include "KWForest.h"
#include "KWHUD.h"
#include "KWPlayerController.h"
#include "KWWorldData.h"
#include "KampenwandRace.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "Engine/DirectionalLight.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/LightComponent.h"
#include "Engine/SkyLight.h"
#include "Components/SkyLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Engine/ExponentialHeightFog.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/VolumetricCloudComponent.h"
#include "Kismet/GameplayStatics.h"

namespace
{
	struct FRiderDef { const TCHAR* Name; FLinearColor Jersey; FLinearColor Pants; FLinearColor Bike; float Skill; };
	const FRiderDef Riders[] = {
		{ TEXT("Du"),             FLinearColor(0.85f, 0.08f, 0.05f), FLinearColor(0.04f, 0.04f, 0.05f), FLinearColor(0.92f, 0.92f, 0.94f), 1.0f },
		{ TEXT("Sepp Huber"),     FLinearColor(0.05f, 0.22f, 0.65f), FLinearColor(0.2f, 0.2f, 0.22f),   FLinearColor(0.08f, 0.08f, 0.09f), 1.05f },
		{ TEXT("Vroni Maier"),    FLinearColor(0.95f, 0.55f, 0.05f), FLinearColor(0.05f, 0.05f, 0.05f), FLinearColor(0.15f, 0.45f, 0.75f), 0.98f },
		{ TEXT("Maxl Gruber"),    FLinearColor(0.1f, 0.5f, 0.15f),   FLinearColor(0.3f, 0.22f, 0.12f),  FLinearColor(0.85f, 0.1f, 0.1f),   0.92f },
		{ TEXT("Resi Brandl"),    FLinearColor(0.75f, 0.15f, 0.55f), FLinearColor(0.08f, 0.08f, 0.12f), FLinearColor(0.95f, 0.8f, 0.1f),   0.95f },
		{ TEXT("Toni Kirchberger"), FLinearColor(0.9f, 0.9f, 0.9f),  FLinearColor(0.1f, 0.15f, 0.35f),  FLinearColor(0.2f, 0.6f, 0.25f),   1.1f  },
	};
	constexpr int32 NumRiders = UE_ARRAY_COUNT(Riders);
}

AKWGameMode::AKWGameMode()
{
	PrimaryActorTick.bCanEverTick = true;
	DefaultPawnClass = AKWBike::StaticClass();
	PlayerControllerClass = AKWPlayerController::StaticClass();
	HUDClass = AKWHUD::StaticClass();
}

void AKWGameMode::EnsureWorld()
{
	if (bWorldBuilt) return;
	bWorldBuilt = true;

	const FKWWorldData& Data = FKWWorldData::Get();
	if (!Data.bLoaded)
	{
		WorldError = Data.Error;
		return;
	}

	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Track = GetWorld()->SpawnActor<AKWTrack>(AKWTrack::StaticClass(), FTransform::Identity, P);
	Track->Build(Data);
	Gondola = GetWorld()->SpawnActor<AKWGondolaLift>(AKWGondolaLift::StaticClass(), FTransform::Identity, P);
	Gondola->Build(Data);
	Forest = GetWorld()->SpawnActor<AKWForest>(AKWForest::StaticClass(), FTransform::Identity, P);
	Forest->Build(Data);
	SpawnEnvironmentIfMissing();
}

void AKWGameMode::SpawnEnvironmentIfMissing()
{
	UWorld* W = GetWorld();
	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	if (!TActorIterator<ADirectionalLight>(W))
	{
		// Nachmittagssonne aus Suedwest
		ADirectionalLight* Sun = W->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(), FVector(0, 0, 200000.f), FRotator(-34.f, -40.f, 0.f), P);
		if (UDirectionalLightComponent* DL = Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
		{
			DL->SetMobility(EComponentMobility::Movable);
			DL->SetAtmosphereSunLight(true);
			DL->SetIntensity(10.f);
			DL->SetLightSourceAngle(0.6f);
		}
	}
	bool bHasAtmosphere = false;
	for (TActorIterator<AActor> It(W); It; ++It)
	{
		if (It->FindComponentByClass<USkyAtmosphereComponent>()) { bHasAtmosphere = true; break; }
	}
	if (!bHasAtmosphere)
	{
		W->SpawnActor<ASkyAtmosphere>(ASkyAtmosphere::StaticClass(), FTransform::Identity, P);
	}
	if (!TActorIterator<ASkyLight>(W))
	{
		ASkyLight* Sky = W->SpawnActor<ASkyLight>(ASkyLight::StaticClass(), FVector(0, 0, 100000.f), FRotator::ZeroRotator, P);
		if (USkyLightComponent* SL = Sky->GetLightComponent())
		{
			SL->SetMobility(EComponentMobility::Movable);
			SL->bRealTimeCapture = true;
			SL->MarkRenderStateDirty();
			SL->RecaptureSky();
		}
	}
	if (!TActorIterator<AExponentialHeightFog>(W))
	{
		AExponentialHeightFog* Fog = W->SpawnActor<AExponentialHeightFog>(AExponentialHeightFog::StaticClass(), FVector(0, 0, 0), FRotator::ZeroRotator, P);
		if (UExponentialHeightFogComponent* F = Fog->GetComponent())
		{
			F->SetFogDensity(0.012f);
			F->SetFogHeightFalloff(0.08f);
			F->SetVolumetricFog(true);
		}
	}
	bool bHasClouds = false;
	for (TActorIterator<AVolumetricCloud> It(W); It; ++It) { bHasClouds = true; break; }
	if (!bHasClouds)
	{
		W->SpawnActor<AVolumetricCloud>(AVolumetricCloud::StaticClass(), FTransform::Identity, P);
	}
}

FTransform AKWGameMode::GridTransform(int32 Slot, float& OutLane) const
{
	// 2 Reihen a 3 Fahrer, versetzt
	const int32 Row = Slot / 3, Col = Slot % 3;
	const float D = 9.f - Row * 4.f;
	OutLane = (Col - 1) * 1.3f;
	const FVector Dir = Track->GetDirectionAtM(D);
	const FVector Loc = Track->GetLocationAtM(D) + Track->GetRightAtM(D) * (OutLane * 100.f) + FVector(0, 0, 60.f);
	return FTransform(FRotationMatrix::MakeFromXZ(Dir, FVector::UpVector).Rotator(), Loc);
}

void AKWGameMode::RestartPlayer(AController* NewPlayer)
{
	EnsureWorld();
	if (!NewPlayer || !Track)
	{
		Super::RestartPlayer(NewPlayer);
		return;
	}
	float Lane = 0.f;
	const FTransform T = GridTransform(4, Lane);   // Spieler startet hinten in der Mitte
	FActorSpawnParameters P;
	P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AKWBike* Bike = GetWorld()->SpawnActor<AKWBike>(AKWBike::StaticClass(), T, P);
	const FRiderDef& R = Riders[0];
	Bike->SetupRider(R.Name, R.Jersey, R.Pants, R.Bike, false, 1.f, Lane);
	Bike->SetFrozen(true);
	NewPlayer->Possess(Bike);
	PlayerBike = Bike;
	Bikes.AddUnique(Bike);
}

void AKWGameMode::StartPlay()
{
	EnsureWorld();
	Super::StartPlay();

	if (Track && !bAISpawned)
	{
		bAISpawned = true;
		const int32 Slots[] = { 0, 1, 2, 3, 5 };
		for (int32 i = 1; i < NumRiders; ++i)
		{
			float Lane = 0.f;
			const FTransform T = GridTransform(Slots[i - 1], Lane);
			FActorSpawnParameters P;
			P.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
			AKWBike* Bike = GetWorld()->SpawnActor<AKWBike>(AKWBike::StaticClass(), T, P);
			const FRiderDef& R = Riders[i];
			Bike->SetupRider(R.Name, R.Jersey, R.Pants, R.Bike, true, R.Skill, Lane);
			Bike->SetFrozen(true);
			Bikes.Add(Bike);
		}
	}
	if (!WorldError.IsEmpty())
	{
		UE_LOG(LogKampenwand, Error, TEXT("%s"), *WorldError);
	}
}

void AKWGameMode::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!Track) return;

	if (Countdown > 0.f)
	{
		Countdown -= DeltaSeconds;
		if (Countdown <= 0.f)
		{
			for (AKWBike* B : Bikes) if (B) B->SetFrozen(false);
		}
	}
	else
	{
		RaceTime += DeltaSeconds;
	}

	const float L = Track->GetLengthM();
	for (AKWBike* B : Bikes)
	{
		if (!B) continue;
		float Lat = 0.f;
		const float D = Track->GetDistanceM(B->GetActorLocation(), &Lat);
		// Fortschritt nur plausibel uebernehmen (kein Sprung durch Abkuerzen ueber Serpentinen)
		if (FMath::Abs(D - B->RaceDistanceM) < 60.f || B->RaceDistanceM < 1.f) B->RaceDistanceM = D;
		B->LateralOffsetM = Lat;
		if (B->FinishTime < 0.f && IsRaceRunning() && B->RaceDistanceM >= L - 3.f)
		{
			B->FinishTime = RaceTime;
		}
	}
	UpdateStandings();
}

void AKWGameMode::UpdateStandings()
{
	TArray<AKWBike*> Sorted = Bikes;
	Sorted.RemoveAll([](const AKWBike* B) { return B == nullptr; });
	Sorted.Sort([](const AKWBike& A, const AKWBike& B)
	{
		const bool FA = A.FinishTime >= 0.f, FB = B.FinishTime >= 0.f;
		if (FA && FB) return A.FinishTime < B.FinishTime;
		if (FA != FB) return FA;
		return A.RaceDistanceM > B.RaceDistanceM;
	});
	for (int32 i = 0; i < Sorted.Num(); ++i) Sorted[i]->Place = i + 1;
}

void AKWGameMode::RestartRace()
{
	UGameplayStatics::OpenLevel(this, FName(*UGameplayStatics::GetCurrentLevelName(this)));
}
