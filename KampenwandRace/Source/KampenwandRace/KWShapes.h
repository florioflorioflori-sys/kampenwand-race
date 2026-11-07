#pragma once

#include "CoreMinimal.h"

class UStaticMesh;
class UMaterialInstanceDynamic;
class USceneComponent;

/** Hilfsfunktionen fuer die Engine-Grundformen (Cube/Cylinder/Sphere/Cone aus /Engine/BasicShapes).
 *  Alle Formen sind 100 cm gross und mittig ausgerichtet; der Zylinder steht entlang +Z. */
namespace KWShapes
{
	UStaticMesh* Cube();
	UStaticMesh* Cylinder();
	UStaticMesh* Sphere();
	UStaticMesh* Cone();

	/** Einfarbiges Material auf Basis von BasicShapeMaterial (Parameter "Color"). */
	UMaterialInstanceDynamic* Color(UObject* Outer, const FLinearColor& InColor);

	/** Transform fuer einen Zylinder von A nach B mit Radius (cm). */
	FTransform Between(const FVector& A, const FVector& B, float RadiusX, float RadiusY = -1.f);

	/** Setzt den relativen Transform einer Komponente so, dass ein Zylinder A und B verbindet. */
	void PlaceBetween(USceneComponent* Comp, const FVector& A, const FVector& B, float RadiusX, float RadiusY = -1.f);

	/** Quader mit Mittelpunkt, Groesse in cm und Rotation. */
	FTransform Box(const FVector& Center, const FVector& SizeCm, const FRotator& Rot = FRotator::ZeroRotator);
}
