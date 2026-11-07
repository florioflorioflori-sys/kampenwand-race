#include "KWWorldData.h"
#include "KampenwandRace.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
	FVector ReadVec(const TArray<TSharedPtr<FJsonValue>>& A, int32 Offset = 0)
	{
		if (A.Num() < Offset + 3) return FVector::ZeroVector;
		return FVector(A[Offset]->AsNumber(), A[Offset + 1]->AsNumber(), A[Offset + 2]->AsNumber());
	}
}

const FKWWorldData& FKWWorldData::Get()
{
	static FKWWorldData Data;
	if (!Data.bLoaded && Data.Error.IsEmpty())
	{
		const FString Path = FPaths::ProjectContentDir() / TEXT("KampenwandData/world.json");
		if (!Data.LoadFromFile(Path))
		{
			UE_LOG(LogKampenwand, Error, TEXT("world.json konnte nicht geladen werden: %s"), *Data.Error);
		}
	}
	return Data;
}

bool FKWWorldData::LoadFromFile(const FString& Path)
{
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *Path))
	{
		Error = FString::Printf(TEXT("Datei fehlt: %s"), *Path);
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		Error = TEXT("JSON ungueltig");
		return false;
	}

	// Landscape
	if (const TSharedPtr<FJsonObject>* L; Root->TryGetObjectField(TEXT("landscape"), L))
	{
		LandscapeLocation = ReadVec((*L)->GetArrayField(TEXT("location_cm")));
		LandscapeScale = ReadVec((*L)->GetArrayField(TEXT("scale")));
	}

	// Strecke
	const TSharedPtr<FJsonObject>* T = nullptr;
	if (!Root->TryGetObjectField(TEXT("track"), T))
	{
		Error = TEXT("track fehlt");
		return false;
	}
	TrackLengthM = (*T)->GetNumberField(TEXT("length_m"));
	for (const TSharedPtr<FJsonValue>& P : (*T)->GetArrayField(TEXT("points")))
	{
		Track.Add(ReadVec(P->AsArray()));
	}

	// Spruenge
	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("jumps")))
	{
		const TSharedPtr<FJsonObject> O = V->AsObject();
		FKWJump J;
		J.Pos = ReadVec(O->GetArrayField(TEXT("pos")));
		J.YawDeg = O->GetNumberField(TEXT("yaw_deg"));
		J.DistM = O->GetNumberField(TEXT("dist_m"));
		J.HeightCm = O->GetNumberField(TEXT("height_cm"));
		Jumps.Add(J);
	}

	// Gondelbahn
	if (const TSharedPtr<FJsonObject>* G; Root->TryGetObjectField(TEXT("gondola"), G))
	{
		SagRatio = (*G)->GetNumberField(TEXT("sag_ratio"));
		for (const TSharedPtr<FJsonValue>& V : (*G)->GetArrayField(TEXT("supports")))
		{
			const TSharedPtr<FJsonObject> O = V->AsObject();
			FKWSupport S;
			S.Ground = ReadVec(O->GetArrayField(TEXT("pos")));
			S.CableZ = O->GetNumberField(TEXT("cable_z_cm"));
			Supports.Add(S);
		}
	}

	// Baeume: [x, y, z, art, skalierung, yaw]
	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("trees")))
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		if (A.Num() < 6) continue;
		FKWTree Tree;
		Tree.Pos = ReadVec(A);
		Tree.Kind = (int32)A[3]->AsNumber();
		Tree.Scale = A[4]->AsNumber();
		Tree.YawDeg = A[5]->AsNumber();
		Trees.Add(Tree);
	}

	// Zuschauer: [x, y, z, yaw]
	for (const TSharedPtr<FJsonValue>& V : Root->GetArrayField(TEXT("spectators")))
	{
		const TArray<TSharedPtr<FJsonValue>>& A = V->AsArray();
		if (A.Num() < 4) continue;
		FKWSpectator S;
		S.Pos = ReadVec(A);
		S.YawDeg = A[3]->AsNumber();
		Spectators.Add(S);
	}

	bLoaded = Track.Num() > 1;
	if (!bLoaded) Error = TEXT("Strecke leer");
	UE_LOG(LogKampenwand, Log, TEXT("Kampenwand-Daten: %d Streckenpunkte, %d Spruenge, %d Stuetzen, %d Baeume"),
		Track.Num(), Jumps.Num(), Supports.Num(), Trees.Num());
	return bLoaded;
}
