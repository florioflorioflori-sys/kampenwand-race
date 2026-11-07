#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "KWBike.generated.h"

class UStaticMesh;
class UBoxComponent;
class UStaticMeshComponent;
class UInstancedStaticMeshComponent;
class USpringArmComponent;
class UCameraComponent;
class UMaterialInstanceDynamic;
class AKWTrack;

/** Eingabe fuer ein Bike, egal ob vom Spieler oder von der KI. */
USTRUCT(BlueprintType)
struct FKWBikeInput
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadWrite) float Steer = 0.f;   // -1 links .. +1 rechts (in der Luft: Whip/Drehen)
	UPROPERTY(BlueprintReadWrite) float Pedal = 0.f;   // 0..1 treten
	UPROPERTY(BlueprintReadWrite) float Brake = 0.f;   // 0..1 bremsen
	UPROPERTY(BlueprintReadWrite) float Pitch = 0.f;   // -1 zuruecklehnen .. +1 nach vorn (wirkt v. a. in der Luft)
	UPROPERTY(BlueprintReadWrite) bool bCrouch = false; // tief gehen; beim Loslassen abdruecken (Bunny-Hop / Pop)
};

/** Ein Rad mit Federung. Alle Laengen in cm, relativ zum Rahmen (Root). */
struct FKWWheel
{
	FVector ExtendedAxle = FVector::ZeroVector; // Achse bei voll ausgefederter Gabel/Daempfer
	FVector Dir = FVector(0, 0, -1);            // Ausfederrichtung (lokal, normiert)
	float TravelCm = 20.f;
	float SpringNpm = 9000.f;                   // Federrate N/m
	float DampCompNspm = 420.f;                 // Druckstufe N*s/m
	float DampRebNspm = 650.f;                  // Zugstufe N*s/m
	float BrakeShare = 0.5f;
	bool bFront = false;

	// Zustand
	float CompressionCm = 0.f;
	float PrevCompressionCm = 0.f;
	bool bContact = false;
	FVector ContactPoint = FVector::ZeroVector;
	FVector ContactNormal = FVector::UpVector;
	float LoadN = 0.f;
	float SpinDeg = 0.f;
	bool bSkidding = false;

	FVector AxleTop() const { return ExtendedAxle - Dir * TravelCm; }
	FVector AxleLocal() const { return ExtendedAxle - Dir * CompressionCm; }
};

/**
 * Downhill-Bike mit eigener Fahrphysik:
 *  - Rahmen als Chaos-Starrkoerper (Bike + Fahrer, 92 kg)
 *  - Gabel und Hinterbau als Feder-Daempfer mit Progression und Durchschlagpuffer (je 200 mm)
 *  - Reifenmodell mit Schlupf (Laengs/Quer) und Reibungskreis, Rollwiderstand, Luftwiderstand
 *  - Fahrer balanciert per Lenkung/Schraeglage; in der Luft Koerpereinsatz (Pitch, Whip)
 *  - Fahrerkoerper als Masse-Feder-System auf dem Bike: die Beine federn Landungen sichtbar ab,
 *    gestreckt in der Luft, tief beim Aufprall - angetrieben von den echten Beschleunigungen des Rahmens
 *  - Beine/Arme per Zwei-Knochen-IK an Pedalen und Lenker
 */
UCLASS()
class KAMPENWANDRACE_API AKWBike : public APawn
{
	GENERATED_BODY()

public:
	AKWBike();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

	void SetBikeInput(const FKWBikeInput& In) { Input = In; }
	void SetupRider(const FString& InName, const FLinearColor& Jersey, const FLinearColor& Pants, const FLinearColor& BikeColor, bool bInAI, float InSkill, float InLane);
	void ResetToTrack(float BackM = 3.f);
	void SetFrozen(bool b) { bFrozen = b; }
	void ToggleCamera();

	float GetSpeedKmh() const;
	bool IsCrashed() const { return CrashTimer > 0.f; }
	bool IsAirborne() const { return !Front.bContact && !Rear.bContact; }
	float GetRiderCompression() const { return -RiderOffsetM.Z; }

	// Rennstatus (setzt der GameMode)
	FString RiderName = TEXT("Fahrer");
	bool bIsAI = false;
	float AISkill = 1.f;
	float AILane = 0.f;
	float RaceDistanceM = 0.f;
	float LateralOffsetM = 0.f;
	float FinishTime = -1.f;
	int32 Place = 0;
	FString LastTrick;
	float TrickTimer = 0.f;

protected:
	UPROPERTY(VisibleAnywhere, Category = "Bike") UBoxComponent* Frame;
	UPROPERTY(VisibleAnywhere, Category = "Bike") USceneComponent* BikeVisual;
	UPROPERTY(VisibleAnywhere, Category = "Bike") USceneComponent* RiderRoot;
	UPROPERTY(VisibleAnywhere, Category = "Bike") USceneComponent* FrontPivot;
	UPROPERTY(VisibleAnywhere, Category = "Bike") USceneComponent* RearPivot;
	UPROPERTY(VisibleAnywhere, Category = "Kamera") USpringArmComponent* CamArm;
	UPROPERTY(VisibleAnywhere, Category = "Kamera") UCameraComponent* ChaseCam;
	UPROPERTY(VisibleAnywhere, Category = "Kamera") UCameraComponent* HelmetCam;

	// Bike-Teile
	UPROPERTY() TArray<UInstancedStaticMeshComponent*> WheelISMs;
	UPROPERTY() UStaticMeshComponent* TopTube;
	UPROPERTY() UStaticMeshComponent* DownTube;
	UPROPERTY() UStaticMeshComponent* SeatTube;
	UPROPERTY() UStaticMeshComponent* Saddle;
	UPROPERTY() UStaticMeshComponent* HeadTube;
	UPROPERTY() UStaticMeshComponent* SwingArm;
	UPROPERTY() UStaticMeshComponent* SeatStay;
	UPROPERTY() UStaticMeshComponent* ShockBody;
	UPROPERTY() UStaticMeshComponent* ShockSpring;
	UPROPERTY() UStaticMeshComponent* ForkUpperL;
	UPROPERTY() UStaticMeshComponent* ForkUpperR;
	UPROPERTY() UStaticMeshComponent* ForkLowerL;
	UPROPERTY() UStaticMeshComponent* ForkLowerR;
	UPROPERTY() UStaticMeshComponent* ForkCrown;
	UPROPERTY() UStaticMeshComponent* Stem;
	UPROPERTY() UStaticMeshComponent* Bar;
	UPROPERTY() UStaticMeshComponent* CrankL;
	UPROPERTY() UStaticMeshComponent* CrankR;
	UPROPERTY() UStaticMeshComponent* PedalL;
	UPROPERTY() UStaticMeshComponent* PedalR;
	UPROPERTY() UStaticMeshComponent* Chainring;

	// Fahrer-Teile
	UPROPERTY() UStaticMeshComponent* Pelvis;
	UPROPERTY() UStaticMeshComponent* Torso;
	UPROPERTY() UStaticMeshComponent* Backpack;
	UPROPERTY() UStaticMeshComponent* Neck;
	UPROPERTY() UStaticMeshComponent* Head;
	UPROPERTY() UStaticMeshComponent* Helmet;
	UPROPERTY() UStaticMeshComponent* ChinBar;
	UPROPERTY() UStaticMeshComponent* Goggles;
	UPROPERTY() UStaticMeshComponent* Peak;
	UPROPERTY() UStaticMeshComponent* UpperArmL;
	UPROPERTY() UStaticMeshComponent* UpperArmR;
	UPROPERTY() UStaticMeshComponent* ForeArmL;
	UPROPERTY() UStaticMeshComponent* ForeArmR;
	UPROPERTY() UStaticMeshComponent* HandL;
	UPROPERTY() UStaticMeshComponent* HandR;
	UPROPERTY() UStaticMeshComponent* ThighL;
	UPROPERTY() UStaticMeshComponent* ThighR;
	UPROPERTY() UStaticMeshComponent* ShinL;
	UPROPERTY() UStaticMeshComponent* ShinR;
	UPROPERTY() UStaticMeshComponent* KneePadL;
	UPROPERTY() UStaticMeshComponent* KneePadR;
	UPROPERTY() UStaticMeshComponent* ShoeL;
	UPROPERTY() UStaticMeshComponent* ShoeR;

private:
	UStaticMeshComponent* MakePart(USceneComponent* Parent, const TCHAR* Name, UStaticMesh* Mesh);
	void BuildWheelVisual(USceneComponent* Pivot, int32 Index);
	void ApplyColors();

	void UpdateWheel(FKWWheel& W, float Dt, float SteerRad, float& InOutDriveN);
	void UpdateBalanceAndAir(float Dt);
	void UpdateRiderDynamics(float Dt);
	void UpdateBikeVisual(float Dt);
	void UpdateRiderRig();
	void UpdateCamera(float Dt);
	void ComputeAIInput(float Dt);
	void CheckCrash(float Dt);
	void StartCrash(const TCHAR* Reason);

	UFUNCTION()
	void OnFrameHit(UPrimitiveComponent* HitComp, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit);

	AKWTrack* GetTrack() const;

	FKWBikeInput Input;
	FKWWheel Front;
	FKWWheel Rear;

	float SteerSmoothed = 0.f;     // -1..1
	float SteerAngleRad = 0.f;
	float CrankAngle = 0.f;        // rad
	float PrevLeanErr = 0.f;
	bool bFrozen = false;

	// Fahrer als Masse-Feder (Huefte relativ zur neutralen Angriffsposition, in m, Bike-Raum)
	FVector RiderOffsetM = FVector::ZeroVector;
	FVector RiderVelM = FVector::ZeroVector;
	FVector PrevVelocityMS = FVector::ZeroVector;
	FVector SmoothedAccel = FVector::ZeroVector;
	float CrouchTime = 0.f;
	bool bPrevCrouch = false;

	float AirTime = 0.f;
	float AirYawAccum = 0.f;
	float CrashTimer = 0.f;
	float OffTrackTimer = 0.f;
	FVector PreLandingVel = FVector::ZeroVector;

	bool bHelmetCam = false;
	FRotator CamRot = FRotator::ZeroRotator;

	FLinearColor JerseyColor = FLinearColor(0.85f, 0.1f, 0.08f);
	FLinearColor PantsColor = FLinearColor(0.05f, 0.05f, 0.06f);
	FLinearColor FrameColor = FLinearColor(0.9f, 0.9f, 0.92f);
};
