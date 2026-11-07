#include "KWShapes.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Components/SceneComponent.h"

namespace
{
	UStaticMesh* LoadMesh(const TCHAR* Path)
	{
		return LoadObject<UStaticMesh>(nullptr, Path);
	}
}

UStaticMesh* KWShapes::Cube()     { static TWeakObjectPtr<UStaticMesh> M; if (!M.IsValid()) M = LoadMesh(TEXT("/Engine/BasicShapes/Cube.Cube")); return M.Get(); }
UStaticMesh* KWShapes::Cylinder() { static TWeakObjectPtr<UStaticMesh> M; if (!M.IsValid()) M = LoadMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder")); return M.Get(); }
UStaticMesh* KWShapes::Sphere()   { static TWeakObjectPtr<UStaticMesh> M; if (!M.IsValid()) M = LoadMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere")); return M.Get(); }
UStaticMesh* KWShapes::Cone()     { static TWeakObjectPtr<UStaticMesh> M; if (!M.IsValid()) M = LoadMesh(TEXT("/Engine/BasicShapes/Cone.Cone")); return M.Get(); }

UMaterialInstanceDynamic* KWShapes::Color(UObject* Outer, const FLinearColor& InColor)
{
	static TWeakObjectPtr<UMaterialInterface> Base;
	if (!Base.IsValid())
	{
		Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	}
	UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(Base.Get(), Outer);
	if (MID)
	{
		MID->SetVectorParameterValue(TEXT("Color"), InColor);
	}
	return MID;
}

FTransform KWShapes::Between(const FVector& A, const FVector& B, float RadiusX, float RadiusY)
{
	const FVector D = B - A;
	const float Len = D.Size();
	const FVector Dir = Len > KINDA_SMALL_NUMBER ? D / Len : FVector::UpVector;
	const FQuat Q = FQuat::FindBetweenNormals(FVector::UpVector, Dir);
	if (RadiusY < 0.f) RadiusY = RadiusX;
	return FTransform(Q, (A + B) * 0.5f, FVector(RadiusX / 50.f, RadiusY / 50.f, FMath::Max(Len, 0.1f) / 100.f));
}

void KWShapes::PlaceBetween(USceneComponent* Comp, const FVector& A, const FVector& B, float RadiusX, float RadiusY)
{
	if (Comp)
	{
		Comp->SetRelativeTransform(Between(A, B, RadiusX, RadiusY));
	}
}

FTransform KWShapes::Box(const FVector& Center, const FVector& SizeCm, const FRotator& Rot)
{
	return FTransform(Rot, Center, SizeCm / 100.f);
}
