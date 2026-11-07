#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "KWGameMode.generated.h"

class AKWTrack;
class AKWBike;
class AKWGondolaLift;
class AKWForest;

/** Baut die Welt aus world.json, setzt Fahrer an den Start, zaehlt runter, misst Zeiten und Platzierungen. */
UCLASS()
class KAMPENWANDRACE_API AKWGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AKWGameMode();

	virtual void StartPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void RestartPlayer(AController* NewPlayer) override;

	AKWTrack* GetTrack() const { return Track; }
	const TArray<AKWBike*>& GetBikes() const { return Bikes; }
	AKWBike* GetPlayerBike() const { return PlayerBike; }
	float GetRaceTime() const { return RaceTime; }
	float GetCountdown() const { return Countdown; }
	bool IsRaceRunning() const { return Countdown <= 0.f; }
	const FString& GetWorldError() const { return WorldError; }

	void RestartRace();

private:
	void EnsureWorld();
	void SpawnEnvironmentIfMissing();
	FTransform GridTransform(int32 Slot, float& OutLane) const;
	void UpdateStandings();

	UPROPERTY() AKWTrack* Track = nullptr;
	UPROPERTY() AKWGondolaLift* Gondola = nullptr;
	UPROPERTY() AKWForest* Forest = nullptr;
	UPROPERTY() TArray<AKWBike*> Bikes;
	UPROPERTY() AKWBike* PlayerBike = nullptr;

	float Countdown = 4.f;
	float RaceTime = 0.f;
	bool bWorldBuilt = false;
	bool bAISpawned = false;
	FString WorldError;
};
