#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "KWGondolaLift.generated.h"

class UStaticMesh;
class UInstancedStaticMeshComponent;
struct FKWWorldData;

/**
 * Kampenwandbahn: Tal- und Bergstation, Stuetzen und umlaufende Kabinen.
 * Die Stuetzen kommen aus Tools/prepare_ue_data.py: Sie sind so gesetzt, dass das durchhaengende Seil
 * ueberall mindestens 12 m Abstand zum Gelaende hat - die Kabinen fahren also nicht mehr in die Felswand.
 */
UCLASS()
class KAMPENWANDRACE_API AKWGondolaLift : public AActor
{
	GENERATED_BODY()

public:
	AKWGondolaLift();
	virtual void Tick(float DeltaSeconds) override;

	void Build(const FKWWorldData& Data);

	UPROPERTY(EditAnywhere, Category = "Gondel") float SpeedMS = 5.f;
	UPROPERTY(EditAnywhere, Category = "Gondel") float CabinSpacingM = 60.f;

private:
	UInstancedStaticMeshComponent* MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bMovable, bool bCollision);
	FVector LoopPos(float U, FVector& OutDir) const;

	TArray<FVector> Loop;      // geschlossene Seilschleife (Weltkoordinaten, cm)
	TArray<float> LoopDist;    // kumulierte Laenge (cm)
	float LoopLength = 0.f;
	float Offset = 0.f;
	int32 NumCabins = 0;

	UPROPERTY() UInstancedStaticMeshComponent* CabinBody;
	UPROPERTY() UInstancedStaticMeshComponent* CabinGlass;
	UPROPERTY() UInstancedStaticMeshComponent* CabinRoof;
	UPROPERTY() UInstancedStaticMeshComponent* Hanger;
	UPROPERTY() TArray<UInstancedStaticMeshComponent*> StaticParts;
};
