// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
use models::power::Power;
use tauri::path::BaseDirectory;
use tauri::{Manager, State};
use csv::ReaderBuilder;
use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::path::PathBuf;

const DESCRIPTIONS_FILE: &str = "power_desc.json";
const SWZ_HEADER: &str = "powerTypes";
const HEADER_STRINGS: &str = "PowerName,PowerID,OrderID,DevNotes,MissionTags,Priority,CastSoundEvent,HitSoundEvent,ItemHitSoundEvent,TargetMethod,ParentItem,OriginPower,IsAirPower,IsSignature,IsAntiair,SigModeSwapsMove,AoERadiusX,AoERadiusY,CenterOffsetX,CenterOffsetY,CastImpulseX,CastImpulseY,FireImpulseX,FireImpulseY,FireImpulseMaxX,ImpulseMaxOnDCOnly,SpeedLimit,SpeedLimitY,SpeedLimitAttack,SpeedLimitBackward,SpeedLimitAttackBackward,SelfImpulseOnHit,EndOnHit,CancelGravity,WallCancel,AllowMove,AllowRecoverMove,AllowJumpDuringRecover,AllowLeaveGround,AllowHitOnZeroDamage,AccelMult,BackwardAccelMult,TurnOffDampening,KeepGroundFriction,IgnoreGroundRestrict,DoNotBounceOffNoSlideCeiling,NoSlideCeilingBuffer,CastAnim,Hurtbox,CastTime,FixedRecoverTime,RecoverTime,AntigravTime,GCancelTime,IgnoreForcedFallTime,ShowCloudTime,CooldownTime,IgnoreCDOverride,OnHitCooldownTime,ShakeTime,DisableShake,OnlyShakeOnce,ShakeAllCams,FixedMinChargeTime,MinCancelTime,LoseInvulnTime,BaseDamage,VariableImpulse,FixedImpulse,MinimumImpulse,PostHitDamageMultiplier,PostHitImpulseMultiplier,ImpulseOffsetX,ImpulseOffsetY,ImpulseOffsetMaxX,ImpulseToPoint,ToPointChangeX,ToPointChangeY,ToPointChangeDmg,LockTo45Degrees,DownwardForceMult,MirrorImpulseOffset,MirrorOffsetCenter,IgnoreStrength,AcceptInput,HeldDirOffsets,DIMaxAngle,ImpulseOnHeavy,ItemSpeedDamage,ItemSpeedImpulse,ItemHitElasticity,AirTimeMultOnly,IsMultihit,MinTimeBetweenHits,InheritAlreadyHit,InterruptThreshold,CanDamageEveryone,CanAssist,ConsumesWeapon,FixedStunTime,HoldHitEnts,HoldOffsetX,HoldOffsetY,UpdateHeldEnts,DestroysItemOnHit,GrabInterpolateTime,GrabAnim,GrabAnimSpeed,GrabForceUpdate,Uninterruptable,CanChangeDirection,ComboName,ComboOverrideIfHit,ComboOverrideIfRelease,ComboOverrideIfWall,ComboOverrideIfButton,OriginOverrideIfInMode,ComboOverrideIfDir,ComboOverrideIfInterrupt,IgnoreButtonOnHit,IgnoreButtonOnMiss,ComboUseSameTargetPos,UseCollisionAsTargetPos,ComboUseTargetAsSource,ComboUseSameSourcePos,BGPowerOnFire,BGCastIdx,AllowBGInterrupt,PopulateActivePowerHits,PopulateBGHits,ExhaustedVersion,GCVersion,MomentumVersion,TeamTauntPower,AnimLayer,FXLayer,IsWorldCastGfx,CustomArtCastGfx,DelayCastGfxToFirstFire,DelayCastGFXCleanUp,CastAnimSource,DoNotSendSync,IsThrow,CannotAttackAroundCorners,ForceHitThroughSoftPlat,ForceFaceRight,CollisionPowerOffSetX,CollisionPowerOffSetY,CastGfx.AnimFile,CastGfx.AnimClass,CastGfx.AnimScale,CastGfx.FireAndForget,CastGfx.MoveAnimSpeed,CastGfx.FlipAnim,CastGfx.Tint,CastGfxRotation,IsWorldFireGfx,IsAttackFireGfx,CustomArtFireGfx,FireAnimSource,FireGfx.AnimFile,FireGfx.AnimClass,FireGfx.AnimScale,FireGfx.FireAndForget,FireGfx.MoveAnimSpeed,FireGfx.FlipAnim,FireGfx.Tint,FireGfxRotation,IsWorldHitGfx,OnlyOnceHitGfx,OwnerFacingHitGfx,PlayHitGfxBehind,HitAnimSource,HitReactAnim,HitGfx.AnimFile,HitGfx.AnimClass,HitGfx.AnimScale,HitGfx.FireAndForget,HitGfx.Tint";

#[tauri::command]
fn get_descriptions(handle: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let descriptions_file = handle
        .path()
        .resolve(DESCRIPTIONS_FILE, BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    let file = std::fs::File::open(&descriptions_file).map_err(|e| e.to_string())?;
    let descriptions: HashMap<String, String> =
        serde_json::from_reader(file).map_err(|e| e.to_string())?;

    Ok(descriptions)
}

#[tauri::command]
fn get_power_list(state: State<AppState>) -> Result<Vec<Power>, String> {
    let power_list = state.power_list.lock().unwrap();
    match &*power_list {
        Some(list) => Ok(list.clone()),
        None => Err("Power list not loaded. Please load a file first.".to_string()),
    }
}

#[tauri::command]
fn load_powers_from_path(file_path: String, state: State<AppState>) -> Result<Vec<Power>, String> {
    println!("Loading powers from path: {}", file_path);
    let file_path = PathBuf::from(file_path);

    if !file_path.exists() {
        return Err(format!("Error: File not found at {:?}", file_path));
    }

    let mut file = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
    let mut buffer = String::new();
    file.read_to_string(&mut buffer)
        .map_err(|e| e.to_string())?;

    // skip the first line if it starts with "powerTypes"
    let content: String = if buffer.starts_with("powerTypes") {
        let mut lines = buffer.lines();
        lines.next(); // Skip the first line
        lines.collect::<Vec<_>>().join("\n")
    } else {
        buffer
    };

    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .from_reader(Cursor::new(content));

    let power_list: Vec<Power> = rdr
        .records()
        .filter_map(|result| match result {
            Ok(record) => {
                let power = Power::from_row(&record);
                Some(power)
            }
            Err(e) => {
                eprintln!("Error reading record: {}", e);
                None
            }
        })
        .collect();

    println!("Loaded {} powers", power_list.len());

    let mut state_power_list = state.power_list.lock().unwrap();
    *state_power_list = Some(power_list.clone());

    Ok(power_list)
}

#[tauri::command]
fn save_power_list_to_path(file_path: String, updated_list: Vec<Power>) -> Result<(), String> {
    let temp_file_path = PathBuf::from(format!("{}.tmp", file_path));

    // write to a temporary file
    let mut temp_file = std::fs::File::create(&temp_file_path).map_err(|e| e.to_string())?;

    writeln!(temp_file, "{SWZ_HEADER}").map_err(|e| e.to_string())?;
    writeln!(temp_file, "{}", HEADER_STRINGS).map_err(|e| e.to_string())?;

    // write the power list
    let mut wtr = csv::WriterBuilder::new()
        .has_headers(false)
        .from_writer(temp_file);
    for power in updated_list {
        wtr.serialize(power).map_err(|e| e.to_string())?;
    }

    // ensure all data is written
    wtr.flush().map_err(|e| e.to_string())?;

    // replace the original file with the temporary file
    std::fs::rename(&temp_file_path, &file_path).map_err(|e| e.to_string())?;

    Ok(())
}

struct AppState {
    // use a Mutex to allow safe access to the power list across threads
    power_list: std::sync::Mutex<Option<Vec<Power>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
        tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            power_list: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_power_list,
            load_powers_from_path,
            save_power_list_to_path,
            get_descriptions
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
