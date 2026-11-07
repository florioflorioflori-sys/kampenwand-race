using UnrealBuildTool;

public class KampenwandRace : ModuleRules
{
	public KampenwandRace(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] {
			"Core", "CoreUObject", "Engine", "InputCore", "Json", "PhysicsCore"
		});
	}
}
