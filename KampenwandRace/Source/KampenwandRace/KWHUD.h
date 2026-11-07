#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "KWHUD.generated.h"

/** Tacho, Zeit, Platz, Countdown, Hoehenprofil mit Fahrerpositionen, Ergebnisliste. */
UCLASS()
class KAMPENWANDRACE_API AKWHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

private:
	void Text(const FString& S, float X, float Y, float Scale, const FLinearColor& C = FLinearColor::White, bool bCenter = false);
	static FString FormatTime(float T);
};
