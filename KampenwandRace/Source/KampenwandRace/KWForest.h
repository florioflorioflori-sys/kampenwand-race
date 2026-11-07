#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "KWForest.generated.h"

class UStaticMesh;
class UHierarchicalInstancedStaticMeshComponent;
struct FKWWorldData;

/** Bergwald (Fichten unten bis zur Waldgrenze, Buchen im Tal) und Zuschauer an der Strecke. */
UCLASS()
class KAMPENWANDRACE_API AKWForest : public AActor
{
	GENERATED_BODY()

public:
	AKWForest();
	void Build(const FKWWorldData& Data);

private:
	UHierarchicalInstancedStaticMeshComponent* MakeHISM(const TCHAR* Name, UStaticMesh* Mesh, const FLinearColor& Color, bool bCollision, float CullCm = 0.f);

	UPROPERTY() TArray<UHierarchicalInstancedStaticMeshComponent*> Parts;
};
