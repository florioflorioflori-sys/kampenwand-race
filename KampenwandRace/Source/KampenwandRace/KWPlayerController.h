#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "KWPlayerController.generated.h"

/**
 * Steuerung ohne Input-Assets (Tasten werden direkt abgefragt):
 *  Tastatur: W/S oder Pfeile = treten/bremsen (in der Luft: nach vorn/zurueck lehnen), A/D = lenken / whippen,
 *            Leertaste = tief gehen, loslassen = abdruecken, R = zurueck auf die Strecke, C = Kamera, Enter = Neustart
 *  Gamepad:  linker Stick = lenken + lehnen, RT = treten, LT = bremsen, A = tief/abdruecken, Y = zurueck, B = Kamera, Start = Neustart
 */
UCLASS()
class KAMPENWANDRACE_API AKWPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AKWPlayerController();
	virtual void BeginPlay() override;
	virtual void PlayerTick(float DeltaTime) override;
};
