#pragma once

#include "CoreMinimal.h"

/** Inhalt von Content/KampenwandData/world.json (erzeugt von Tools/prepare_ue_data.py).
 *  Alle Positionen in UE-Weltkoordinaten (cm): X = Osten, Y = Sueden, Z = Hoehe ueber 600 m ue. NN. */
struct FKWJump
{
	FVector Pos = FVector::ZeroVector;
	float YawDeg = 0.f;
	float DistM = 0.f;
	float HeightCm = 100.f;
};

struct FKWSupport
{
	FVector Ground = FVector::ZeroVector;   // Fusspunkt der Stuetze / Station
	float CableZ = 0.f;                     // Seilhoehe an dieser Stuetze
};

struct FKWTree
{
	FVector Pos = FVector::ZeroVector;
	int32 Kind = 0;      // 0 = Fichte, 1 = Buche
	float Scale = 1.f;
	float YawDeg = 0.f;
};

struct FKWSpectator
{
	FVector Pos = FVector::ZeroVector;
	float YawDeg = 0.f;
};

struct FKWWorldData
{
	TArray<FVector> Track;
	float TrackLengthM = 0.f;
	TArray<FKWJump> Jumps;
	TArray<FKWSupport> Supports;
	float SagRatio = 0.035f;
	TArray<FKWTree> Trees;
	TArray<FKWSpectator> Spectators;
	FVector LandscapeLocation = FVector::ZeroVector;
	FVector LandscapeScale = FVector(100.f);

	bool bLoaded = false;
	FString Error;

	/** Laedt die Daten beim ersten Aufruf. */
	static const FKWWorldData& Get();

private:
	bool LoadFromFile(const FString& Path);
};
