#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "KWTrack.generated.h"

class UStaticMesh;
class USplineComponent;
class UInstancedStaticMeshComponent;
class UHierarchicalInstancedStaticMeshComponent;
class UTextRenderComponent;
struct FKWWorldData;

/** Die Downhill-Strecke Bergstation -> Aschau: Spline, Absperrband, Kicker, Start- und Zielbogen. */
UCLASS()
class KAMPENWANDRACE_API AKWTrack : public AActor
{
	GENERATED_BODY()

public:
	AKWTrack();

	void Build(const FKWWorldData& Data);

	float GetLengthM() const;
	/** Distanz entlang der Strecke (m); optional seitlicher Abstand zur Mittellinie (m). */
	float GetDistanceM(const FVector& World, float* OutLateralM = nullptr) const;
	FVector GetLocationAtM(float M) const;
	FVector GetDirectionAtM(float M) const;
	FVector GetRightAtM(float M) const;
	/** Mittlere Kruemmung (1/m) zwischen FromM und FromM + SpanM. */
	float GetCurvatureAheadM(float FromM, float SpanM) const;

	UPROPERTY(VisibleAnywhere, Category = "Strecke") USplineComponent* Spline;

private:
	UHierarchicalInstancedStaticMeshComponent* MakeISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bCollision);
	FVector GroundAt(const FVector& P) const;
	void BuildGate(float DistM, const FString& Text, const FLinearColor& Color);

	UPROPERTY() TArray<UHierarchicalInstancedStaticMeshComponent*> ISMs;
	UPROPERTY() TArray<UTextRenderComponent*> Texts;
};
