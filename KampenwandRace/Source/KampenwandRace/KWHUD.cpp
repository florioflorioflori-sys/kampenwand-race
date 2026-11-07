#include "KWHUD.h"
#include "KWGameMode.h"
#include "KWBike.h"
#include "KWTrack.h"
#include "KWWorldData.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"

FString AKWHUD::FormatTime(float T)
{
	if (T < 0.f) return TEXT("--:--.--");
	const int32 M = FMath::FloorToInt(T / 60.f);
	return FString::Printf(TEXT("%d:%05.2f"), M, T - M * 60.f);
}

void AKWHUD::Text(const FString& S, float X, float Y, float Scale, const FLinearColor& C, bool bCenter)
{
	UFont* Font = GEngine->GetLargeFont();
	if (bCenter)
	{
		float W = 0, H = 0;
		GetTextSize(S, W, H, Font, Scale);
		X -= W * 0.5f;
	}
	DrawText(S, FLinearColor(0, 0, 0, 0.7f), X + 2.f, Y + 2.f, Font, Scale);
	DrawText(S, C, X, Y, Font, Scale);
}

void AKWHUD::DrawHUD()
{
	Super::DrawHUD();
	const AKWGameMode* GM = GetWorld()->GetAuthGameMode<AKWGameMode>();
	if (!GM || !Canvas) return;
	const float W = Canvas->ClipX, H = Canvas->ClipY;
	const float U = H / 1080.f;

	if (!GM->GetWorldError().IsEmpty() || !GM->GetTrack())
	{
		Text(TEXT("Kampenwand-Daten fehlen: ") + GM->GetWorldError(), W * 0.5f, H * 0.4f, 1.4f * U, FLinearColor(1, 0.3f, 0.2f), true);
		Text(TEXT("Content/KampenwandData/world.json muss im Projekt liegen (siehe README)."), W * 0.5f, H * 0.46f, 1.0f * U, FLinearColor::White, true);
		return;
	}

	AKWBike* Me = GM->GetPlayerBike();
	const TArray<AKWBike*>& Bikes = GM->GetBikes();
	const float L = GM->GetTrack()->GetLengthM();

	// Countdown / Startinfo
	if (GM->GetCountdown() > 0.f)
	{
		const int32 N = FMath::CeilToInt(GM->GetCountdown() - 1.f);
		Text(N > 0 ? FString::FromInt(N) : TEXT("LOS!"), W * 0.5f, H * 0.3f, 5.f * U, FLinearColor(1.f, 0.85f, 0.2f), true);
		Text(TEXT("W treten  S bremsen  A/D lenken  Leertaste tief/abdruecken  C Kamera  R zurueck"), W * 0.5f, H * 0.82f, 1.0f * U, FLinearColor::White, true);
	}

	if (Me)
	{
		// Tacho unten rechts
		Text(FString::Printf(TEXT("%3.0f km/h"), Me->GetSpeedKmh()), W - 330.f * U, H - 140.f * U, 3.f * U);
		// Federweg der Beine (wie stark der Fahrer gerade abfedert)
		const float Comp = FMath::Clamp(Me->GetRiderCompression() / 0.27f, 0.f, 1.f);
		DrawRect(FLinearColor(0, 0, 0, 0.4f), W - 330.f * U, H - 60.f * U, 260.f * U, 14.f * U);
		DrawRect(FLinearColor(0.2f, 0.8f, 1.f, 0.9f), W - 330.f * U, H - 60.f * U, 260.f * U * Comp, 14.f * U);
		Text(TEXT("Beine"), W - 330.f * U, H - 44.f * U, 0.8f * U);

		// Platz und Zeit oben links
		Text(FString::Printf(TEXT("Platz %d / %d"), Me->Place, Bikes.Num()), 40.f * U, 30.f * U, 2.2f * U);
		Text(FormatTime(Me->FinishTime >= 0.f ? Me->FinishTime : GM->GetRaceTime()), 40.f * U, 85.f * U, 2.f * U, FLinearColor(1.f, 0.9f, 0.4f));
		Text(FString::Printf(TEXT("noch %.0f m"), FMath::Max(0.f, L - Me->RaceDistanceM)), 40.f * U, 135.f * U, 1.2f * U);

		if (Me->TrickTimer > 0.f && !Me->LastTrick.IsEmpty())
		{
			Text(Me->LastTrick, W * 0.5f, H * 0.18f, 2.2f * U, Me->IsCrashed() ? FLinearColor(1.f, 0.3f, 0.2f) : FLinearColor(0.4f, 1.f, 0.5f), true);
		}
		if (Me->LateralOffsetM > 12.f && !Me->IsCrashed())
		{
			Text(TEXT("Zurueck zur Strecke!  (R)"), W * 0.5f, H * 0.25f, 1.6f * U, FLinearColor(1.f, 0.6f, 0.2f), true);
		}
	}

	// Hoehenprofil mit allen Fahrern
	{
		const FKWWorldData& D = FKWWorldData::Get();
		const float X0 = W * 0.3f, X1 = W * 0.7f, Y0 = 30.f * U, PH = 70.f * U;
		DrawRect(FLinearColor(0, 0, 0, 0.35f), X0 - 8.f, Y0 - 8.f, X1 - X0 + 16.f, PH + 16.f);
		float ZMin = 1e9f, ZMax = -1e9f;
		for (const FVector& P : D.Track) { ZMin = FMath::Min(ZMin, P.Z); ZMax = FMath::Max(ZMax, P.Z); }
		const int32 N = D.Track.Num();
		for (int32 i = 1; i < N; i += 2)
		{
			const float X = FMath::Lerp(X0, X1, (float)i / (N - 1));
			const float Y = Y0 + PH * (1.f - (D.Track[i].Z - ZMin) / FMath::Max(ZMax - ZMin, 1.f));
			DrawRect(FLinearColor(0.4f, 0.65f, 0.35f, 0.8f), X, Y, 2.f, Y0 + PH - Y);
		}
		for (const AKWBike* B : Bikes)
		{
			if (!B) continue;
			const float T = FMath::Clamp(B->RaceDistanceM / L, 0.f, 1.f);
			const int32 Idx = FMath::Clamp(FMath::RoundToInt(T * (N - 1)), 0, N - 1);
			const float X = FMath::Lerp(X0, X1, T);
			const float Y = Y0 + PH * (1.f - (D.Track[Idx].Z - ZMin) / FMath::Max(ZMax - ZMin, 1.f));
			const bool bMe = B == Me;
			DrawRect(bMe ? FLinearColor(1.f, 0.2f, 0.1f) : FLinearColor::White, X - 5.f, Y - 12.f, 10.f, 10.f);
		}
		Text(TEXT("Bergstation 1437 m"), X0, Y0 + PH + 10.f, 0.75f * U);
		Text(TEXT("Aschau 624 m"), X1 - 120.f * U, Y0 + PH + 10.f, 0.75f * U);
	}

	// Ergebnisliste, sobald der Spieler im Ziel ist
	if (Me && Me->FinishTime >= 0.f)
	{
		TArray<const AKWBike*> Sorted;
		for (const AKWBike* B : Bikes) if (B) Sorted.Add(B);
		Sorted.Sort([](const AKWBike& A, const AKWBike& B) { return A.Place < B.Place; });
		const float X = W * 0.5f - 300.f * U, Y = H * 0.32f;
		DrawRect(FLinearColor(0, 0, 0, 0.6f), X - 20.f * U, Y - 70.f * U, 640.f * U, (90.f + Sorted.Num() * 44.f) * U);
		Text(TEXT("ERGEBNIS  Kampenwand Downhill"), W * 0.5f, Y - 60.f * U, 1.6f * U, FLinearColor(1.f, 0.85f, 0.2f), true);
		for (int32 i = 0; i < Sorted.Num(); ++i)
		{
			const AKWBike* B = Sorted[i];
			const FLinearColor C = B == Me ? FLinearColor(1.f, 0.5f, 0.4f) : FLinearColor::White;
			Text(FString::Printf(TEXT("%d.  %s"), B->Place, *B->RiderName), X, Y + i * 44.f * U, 1.3f * U, C);
			Text(B->FinishTime >= 0.f ? FormatTime(B->FinishTime) : FString::Printf(TEXT("%.0f m"), L - B->RaceDistanceM), X + 430.f * U, Y + i * 44.f * U, 1.3f * U, C);
		}
		Text(TEXT("Enter = neues Rennen"), W * 0.5f, Y + (Sorted.Num() * 44.f + 10.f) * U, 1.f * U, FLinearColor::White, true);
	}
}
