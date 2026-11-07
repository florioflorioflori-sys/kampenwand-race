#include "KWPlayerController.h"
#include "KWBike.h"
#include "KWGameMode.h"
#include "InputCoreTypes.h"
#include "Engine/World.h"

AKWPlayerController::AKWPlayerController()
{
	bShowMouseCursor = false;
}

void AKWPlayerController::BeginPlay()
{
	Super::BeginPlay();
	SetInputMode(FInputModeGameOnly());
}

void AKWPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	AKWBike* Bike = Cast<AKWBike>(GetPawn());
	if (!Bike) return;

	auto Key = [this](const FKey& K) { return IsInputKeyDown(K) ? 1.f : 0.f; };

	FKWBikeInput In;
	const float PadX = GetInputAnalogKeyState(EKeys::Gamepad_LeftX);
	const float PadY = GetInputAnalogKeyState(EKeys::Gamepad_LeftY);
	In.Steer = FMath::Clamp(Key(EKeys::D) + Key(EKeys::Right) - Key(EKeys::A) - Key(EKeys::Left) + PadX, -1.f, 1.f);
	In.Pedal = FMath::Clamp(Key(EKeys::W) + Key(EKeys::Up) + GetInputAnalogKeyState(EKeys::Gamepad_RightTriggerAxis), 0.f, 1.f);
	In.Brake = FMath::Clamp(Key(EKeys::S) + Key(EKeys::Down) + GetInputAnalogKeyState(EKeys::Gamepad_LeftTriggerAxis), 0.f, 1.f);
	In.Pitch = FMath::Clamp(Key(EKeys::W) + Key(EKeys::Up) - Key(EKeys::S) - Key(EKeys::Down) + PadY, -1.f, 1.f);
	In.bCrouch = IsInputKeyDown(EKeys::SpaceBar) || IsInputKeyDown(EKeys::Gamepad_FaceButton_Bottom);
	Bike->SetBikeInput(In);

	if (WasInputKeyJustPressed(EKeys::R) || WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Top))
	{
		Bike->ResetToTrack(3.f);
	}
	if (WasInputKeyJustPressed(EKeys::C) || WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Right))
	{
		Bike->ToggleCamera();
	}
	if (WasInputKeyJustPressed(EKeys::Enter) || WasInputKeyJustPressed(EKeys::Gamepad_Special_Right))
	{
		if (AKWGameMode* GM = GetWorld()->GetAuthGameMode<AKWGameMode>())
		{
			GM->RestartRace();
		}
	}
}
