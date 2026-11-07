"""
Kampenwand-Setup fuer den Unreal Editor (Werkzeuge > Python-Skript ausfuehren).

1. Importiert die Trail-Maske als Textur.
2. Baut das Gelaendematerial M_Kampenwand_Gelaende (Wiese, Almboden, Fels, Erdtrail; nur Farben, keine Fremd-Assets).
3. Sucht die Landscape im offenen Level, setzt Position/Skalierung exakt auf die Werte aus world.json
   (damit Strecke, Gondelbahn und Baeume genau auf dem Gelaende liegen) und weist das Material zu.

Danach Level speichern (Strg+S) als Content/Maps/Kampenwand.
"""
import json
import os
import unreal

PROJECT_DIR = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
WORLD_JSON = os.path.join(PROJECT_DIR, "Content", "KampenwandData", "world.json")
MASK_PNG = os.path.join(PROJECT_DIR, "RawData", "Kampenwand_TrailMask_2017.png")
DEST = "/Game/Kampenwand"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary


def log(msg):
    unreal.log("[Kampenwand] " + msg)


def import_mask():
    task = unreal.AssetImportTask()
    task.filename = MASK_PNG
    task.destination_path = DEST
    task.destination_name = "T_Kampenwand_TrailMaske"
    task.automated = True
    task.replace_existing = True
    task.save = True
    asset_tools.import_asset_tasks([task])
    tex = unreal.load_asset(DEST + "/T_Kampenwand_TrailMaske")
    if tex:
        tex.set_editor_property("srgb", False)
        tex.set_editor_property("compression_settings", unreal.TextureCompressionSettings.TC_GRAYSCALE)
        tex.set_editor_property("address_x", unreal.TextureAddress.TA_CLAMP)
        tex.set_editor_property("address_y", unreal.TextureAddress.TA_CLAMP)
        unreal.EditorAssetLibrary.save_loaded_asset(tex)
    return tex


HLSL = r"""
// Gelaendefarbe aus Hoehe, Hangneigung, Trail-Maske und etwas Rauschen
float slope = 1.0 - saturate(N.z);
float h = WP.z / 100.0 + 600.0;                       // Meter ueber NN
float2 p = WP.xy / 100.0;
float n1 = frac(sin(dot(floor(p / 7.0), float2(12.9898, 78.233))) * 43758.5453);
float n2 = frac(sin(dot(floor(p / 1.5), float2(39.346, 11.135))) * 24634.6345);
float n = lerp(n1, n2, 0.35);

float3 wiese   = lerp(float3(0.10, 0.20, 0.04), float3(0.16, 0.26, 0.06), n);
float3 alm     = lerp(float3(0.20, 0.24, 0.09), float3(0.27, 0.27, 0.13), n);
float3 wald    = lerp(float3(0.07, 0.09, 0.04), float3(0.10, 0.08, 0.05), n);   // Nadelstreu
float3 fels    = lerp(float3(0.42, 0.41, 0.38), float3(0.56, 0.55, 0.51), n);   // Wettersteinkalk, hell
float3 erde    = lerp(float3(0.20, 0.13, 0.07), float3(0.27, 0.18, 0.10), n2);

float almW  = smoothstep(1350.0, 1480.0, h);
float waldW = saturate(1.0 - almW) * smoothstep(0.12, 0.30, slope) * 0.7;
float3 c = lerp(wiese, alm, almW);
c = lerp(c, wald, waldW);
c = lerp(c, fels, smoothstep(0.42, 0.62, slope + (h > 1450.0 ? 0.12 : 0.0)));
c = lerp(c, erde, saturate(Trail * 1.4));
return c;
"""


def build_material(tex):
    path = DEST + "/M_Kampenwand_Gelaende"
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        unreal.EditorAssetLibrary.delete_asset(path)
    mat = asset_tools.create_asset("M_Kampenwand_Gelaende", DEST, unreal.Material, unreal.MaterialFactoryNew())

    wp = mel.create_material_expression(mat, unreal.MaterialExpressionWorldPosition, -900, 0)
    nrm = mel.create_material_expression(mat, unreal.MaterialExpressionVertexNormalWS, -900, 200)

    # UV aus Weltposition: Landscape deckt -200000..+200000 cm ab
    mask_wp = mel.create_material_expression(mat, unreal.MaterialExpressionComponentMask, -750, 400)
    mask_wp.set_editor_property("r", True)
    mask_wp.set_editor_property("g", True)
    mel.connect_material_expressions(wp, "", mask_wp, "")
    add = mel.create_material_expression(mat, unreal.MaterialExpressionAdd, -600, 400)
    add.set_editor_property("const_b", 200000.0)
    mel.connect_material_expressions(mask_wp, "", add, "A")
    div = mel.create_material_expression(mat, unreal.MaterialExpressionDivide, -450, 400)
    div.set_editor_property("const_b", 400000.0)
    mel.connect_material_expressions(add, "", div, "A")

    trail = mel.create_material_expression(mat, unreal.MaterialExpressionTextureSample, -300, 400)
    if tex:
        trail.set_editor_property("texture", tex)
        trail.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_GRAYSCALE)
    mel.connect_material_expressions(div, "", trail, "UVs")

    custom = mel.create_material_expression(mat, unreal.MaterialExpressionCustom, -200, 0)
    custom.set_editor_property("code", HLSL)
    custom.set_editor_property("output_type", unreal.CustomMaterialOutputType.CMOT_FLOAT3)
    custom.set_editor_property("description", "Kampenwand Gelaende")
    inputs = []
    for name in ("WP", "N", "Trail"):
        ci = unreal.CustomInput()
        ci.set_editor_property("input_name", name)
        inputs.append(ci)
    custom.set_editor_property("inputs", inputs)
    mel.connect_material_expressions(wp, "", custom, "WP")
    mel.connect_material_expressions(nrm, "", custom, "N")
    mel.connect_material_expressions(trail, "R", custom, "Trail")

    rough = mel.create_material_expression(mat, unreal.MaterialExpressionConstant, -200, 250)
    rough.set_editor_property("r", 0.92)

    mel.connect_material_property(custom, "", unreal.MaterialProperty.MP_BASE_COLOR)
    mel.connect_material_property(rough, "", unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(mat)
    unreal.EditorAssetLibrary.save_loaded_asset(mat)
    log("Material erstellt: " + path)
    return mat


def place_landscape(mat):
    with open(WORLD_JSON, "r", encoding="utf-8") as f:
        land = json.load(f)["landscape"]
    loc = unreal.Vector(*land["location_cm"])
    scale = unreal.Vector(*land["scale"])

    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    lands = [a for a in actors if isinstance(a, unreal.LandscapeProxy)]
    if not lands:
        unreal.log_warning("[Kampenwand] Keine Landscape im Level gefunden - bitte zuerst die Heightmap importieren (README Schritt 4).")
        return
    for a in lands:
        if isinstance(a, unreal.Landscape) or len(lands) == 1:
            a.set_actor_location(loc, False, False)
            a.set_actor_rotation(unreal.Rotator(0, 0, 0), False)
            a.set_actor_scale3d(scale)
        if mat:
            a.set_editor_property("landscape_material", mat)
    log("Landscape ausgerichtet: Position %s, Skalierung %s" % (loc, scale))


def main():
    unreal.EditorAssetLibrary.make_directory(DEST)
    tex = import_mask()
    mat = build_material(tex)
    place_landscape(mat)
    log("Fertig. Jetzt Level speichern (Strg+S) als /Game/Maps/Kampenwand und mit Alt+P losfahren.")


main()
