using UnrealBuildTool;

public class KampenwandRaceTarget : TargetRules
{
	public KampenwandRaceTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("KampenwandRace");
	}
}
