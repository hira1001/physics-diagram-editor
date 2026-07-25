import type { DiagramElement, DiagramElementKind, ToolId } from "@/app/lib/editor-types";

export type ComponentCategory = "物体" | "接触面" | "支持" | "接続" | "機械要素" | "軌道" | "流体" | "ベクトル" | "注釈";

export interface ComponentCatalogEntry {
  aliases: string[];
  category: ComponentCategory;
  defaultHeight: number;
  defaultLabel: string;
  defaultWidth: number;
  kind: DiagramElementKind;
  name: string;
  physics: string[];
}

export type CatalogSurfaceKind = Extract<DiagramElementKind,
  "smooth-floor" | "rough-floor" | "smooth-wall" | "rough-wall" | "smooth-incline" | "rough-incline"
>;

export interface CatalogSurfacePreset {
  direction: "floor" | "incline" | "wall";
  roughness: "rough" | "smooth";
}

const catalogSurfacePresets: Record<CatalogSurfaceKind, CatalogSurfacePreset> = {
  "smooth-floor": { direction: "floor", roughness: "smooth" },
  "rough-floor": { direction: "floor", roughness: "rough" },
  "smooth-wall": { direction: "wall", roughness: "smooth" },
  "rough-wall": { direction: "wall", roughness: "rough" },
  "smooth-incline": { direction: "incline", roughness: "smooth" },
  "rough-incline": { direction: "incline", roughness: "rough" },
};

const entry = (
  kind: DiagramElementKind,
  name: string,
  category: ComponentCategory,
  defaultWidth: number,
  defaultHeight: number,
  defaultLabel = "",
  aliases: string[] = [],
  physics: string[] = [],
): ComponentCatalogEntry => ({ aliases, category, defaultHeight, defaultLabel, defaultWidth, kind, name, physics });

export const PHYSICS_COMPONENT_CATALOG: readonly ComponentCatalogEntry[] = [
  entry("point-mass", "質点", "物体", 20, 20, "m", ["点質量"], ["質量", "作用点"]),
  entry("block", "物体", "物体", 120, 76, "m", ["ブロック", "直方体"], ["質量", "重心", "接触"]),
  entry("sphere", "球", "物体", 82, 82, "m", ["小球"], ["中心", "半径", "転がり"]),
  entry("disk", "円板", "物体", 92, 92, "I", ["ディスク"], ["中心", "半径", "回転", "慣性モーメント"]),
  entry("cylinder", "円柱", "物体", 104, 86, "I", ["シリンダー"], ["中心", "半径", "回転", "転がり", "慣性モーメント"]),
  entry("wedge", "くさび", "物体", 150, 86, "M", ["楔"], ["質量", "接触面"]),
  entry("cart", "台車", "物体", 140, 78, "M", ["車", "カート"], ["質量", "車輪接触", "速度"]),

  entry("smooth-floor", "滑らかな床", "接触面", 190, 24, "", ["摩擦なし床", "なめらかな床"], ["上向き法線", "摩擦なし", "接触"]),
  entry("rough-floor", "粗い床", "接触面", 190, 24, "μ", ["摩擦あり床", "あらい床"], ["上向き法線", "摩擦", "摩擦係数", "接触"]),
  entry("smooth-wall", "滑らかな壁", "接触面", 190, 24, "", ["摩擦なし壁", "なめらかな壁"], ["水平法線", "摩擦なし", "接触"]),
  entry("rough-wall", "粗い壁", "接触面", 190, 24, "μ", ["摩擦あり壁", "あらい壁"], ["水平法線", "摩擦", "摩擦係数", "接触"]),
  entry("smooth-incline", "滑らかな斜面", "接触面", 180, 104, "θ", ["摩擦なし斜面", "なめらかな斜面"], ["面の法線", "摩擦なし", "接触", "傾斜角"]),
  entry("rough-incline", "粗い斜面", "接触面", 180, 104, "θ", ["摩擦あり斜面", "あらい斜面"], ["面の法線", "摩擦", "摩擦係数", "接触", "傾斜角"]),
  entry("ceiling", "天井", "接触面", 180, 24, "", ["上面"], ["下向き法線", "摩擦"]),
  entry("step", "段差", "接触面", 160, 100, "", ["階段"], ["複数接触点", "法線"]),
  entry("corner", "角", "接触面", 120, 120, "", ["隅", "コーナー"], ["二面接触", "複数反力"]),
  entry("curved-surface", "曲面", "接触面", 170, 90, "", ["曲面接触"], ["局所法線", "接線"]),

  entry("fixed-end", "固定端", "支持", 48, 120, "", ["固定支点"], ["並進拘束", "回転拘束", "反力", "モーメント"]),
  entry("pin-support", "ピン支点", "支持", 90, 82, "", ["ピン"], ["並進拘束", "回転許容", "支点反力"]),
  entry("hinge", "ヒンジ", "支持", 66, 66, "", ["蝶番"], ["回転許容", "支点反力"]),
  entry("roller-support", "ローラー支点", "支持", 100, 82, "", ["ローラー"], ["法線反力", "接線移動"]),
  entry("simple-support", "単純支持", "支持", 180, 90, "", ["単純梁"], ["ピン反力", "ローラー反力"]),
  entry("strut", "支柱", "支持", 150, 24, "", ["柱"], ["軸力", "端点接続"]),

  entry("string", "糸", "接続", 170, 16, "T", ["軽い糸"], ["端点追従", "張力"]),
  entry("rope", "ロープ", "接続", 170, 20, "T", ["綱"], ["端点追従", "張力"]),
  entry("cable", "ケーブル", "接続", 170, 26, "T", ["索"], ["端点追従", "張力"]),
  entry("light-rod", "軽い棒", "接続", 170, 20, "S", ["棒", "ロッド"], ["端点追従", "軸力"]),
  entry("spring", "ばね", "接続", 170, 38, "k", ["スプリング"], ["端点追従", "弾性力", "ばね定数"]),
  entry("damper", "ダンパー", "接続", 170, 46, "c", ["減衰器"], ["端点追従", "減衰力", "減衰係数"]),

  entry("fixed-pulley", "固定滑車", "機械要素", 94, 120, "T", ["定滑車"], ["糸経路", "同一張力"]),
  entry("movable-pulley", "動滑車", "機械要素", 110, 130, "T", ["可動滑車"], ["支持区間", "同一張力"]),
  entry("compound-pulley", "組合せ滑車", "機械要素", 170, 150, "T", ["複合滑車"], ["複数糸区間", "同一張力"]),
  entry("wheel-axle", "輪軸", "機械要素", 116, 116, "τ", ["車軸"], ["回転中心", "半径差", "モーメント"]),
  entry("rotation-axis", "回転軸", "機械要素", 74, 74, "O", ["軸"], ["回転中心"]),
  entry("belt", "ベルト・コンベア", "機械要素", 190, 86, "v", ["ベルト", "コンベア"], ["移動方向", "速度", "摩擦"]),

  entry("straight-track", "直線軌道", "軌道", 190, 24, "", ["レール"], ["接線", "拘束運動"]),
  entry("circular-track", "円軌道", "軌道", 150, 150, "R", ["円運動"], ["中心", "半径", "接線"]),
  entry("curved-track", "曲線軌道", "軌道", 190, 110, "", ["曲線レール"], ["局所接線", "曲率"]),
  entry("projectile-path", "放物軌道", "軌道", 190, 110, "", ["投射軌道", "放物線"], ["速度", "加速度"]),

  entry("fluid-surface", "液面", "流体", 190, 34, "", ["水面"], ["圧力", "浮力"]),
  entry("container", "容器", "流体", 150, 130, "", ["水槽"], ["境界", "流体領域"]),
  entry("fluid-region", "流体領域", "流体", 170, 110, "ρ", ["液体", "流体"], ["密度", "浮力"]),

  entry("force", "一般力", "ベクトル", 130, 20, "F", ["力", "外力"], ["作用点", "方向", "大きさ"]),
  entry("gravity", "重力", "ベクトル", 130, 20, "mg", ["重量"], ["鉛直下向き"]),
  entry("normal-force", "垂直抗力", "ベクトル", 130, 20, "N", ["法線力"], ["接触面法線"]),
  entry("friction-force", "摩擦力", "ベクトル", 130, 20, "f", ["摩擦"], ["接触面接線"]),
  entry("tension", "張力", "ベクトル", 130, 20, "T", ["糸の力"], ["接続方向", "同一張力"]),
  entry("spring-force", "ばね力", "ベクトル", 130, 20, "Fₛ", ["弾性力"], ["ばね方向"]),
  entry("drag-force", "抗力", "ベクトル", 130, 20, "D", ["抵抗力", "空気抵抗"], ["速度反対方向"]),
  entry("buoyancy", "浮力", "ベクトル", 130, 20, "Fᵦ", ["アルキメデス力"], ["鉛直上向き", "浮心"]),
  entry("thrust", "推力", "ベクトル", 130, 20, "P", ["駆動力"], ["作用点", "方向"]),
  entry("velocity", "速度", "ベクトル", 130, 20, "v", ["速度ベクトル"], ["方向", "大きさ"]),
  entry("acceleration", "加速度", "ベクトル", 130, 20, "a", ["加速度ベクトル"], ["方向", "大きさ"]),
  entry("momentum", "運動量", "ベクトル", 130, 20, "p", ["運動量ベクトル"], ["方向", "大きさ"]),
  entry("moment", "モーメント", "ベクトル", 96, 96, "M", ["トルク", "力のモーメント"], ["回転中心", "回転方向"]),
  entry("angular-velocity", "角速度", "ベクトル", 96, 96, "ω", ["角速度ベクトル", "オメガ"], ["回転中心", "回転方向", "大きさ"]),
  entry("angular-acceleration", "角加速度", "ベクトル", 96, 96, "α", ["角加速度ベクトル", "アルファ"], ["回転中心", "回転方向", "大きさ"]),
  entry("rotation-direction", "回転方向", "ベクトル", 86, 86, "", ["回転矢印", "回る向き"], ["時計回り", "反時計回り", "方向反転"]),

  entry("local-axis", "座標軸", "注釈", 120, 120, "x,y", ["斜面座標軸", "x-y軸"], ["対象追従"]),
  entry("angle-arc", "角度弧", "注釈", 100, 100, "θ", ["角度"], ["二辺参照"]),
  entry("length-dimension", "長さ寸法", "注釈", 150, 28, "L", ["寸法線"], ["辺参照"]),
  entry("radius-dimension", "半径寸法", "注釈", 100, 100, "R", ["半径"], ["円参照"]),
  entry("center-of-mass", "重心", "注釈", 34, 34, "G", ["質量中心"], ["物体追従"]),
  entry("point-label", "点", "注釈", 28, 28, "A", ["点ラベル"], ["対象参照"]),
  entry("construction-line", "補助線", "注釈", 170, 18, "", ["推論線", "破線"], ["出力制御"]),
  entry("text", "テキスト", "注釈", 120, 42, "注記", ["文字", "ラベル"], ["対象追従"]),
] as const;

const byKind = new Map(PHYSICS_COMPONENT_CATALOG.map((item) => [item.kind, item]));

export function isDiagramElementKind(value: unknown): value is DiagramElementKind {
  return typeof value === "string" && byKind.has(value as DiagramElementKind);
}

export function catalogEntry(kind: DiagramElementKind) {
  return byKind.get(kind)!;
}

export function catalogEntryForTool(tool: ToolId) {
  if (!tool.startsWith("part:")) return null;
  const kind = tool.slice(5);
  return isDiagramElementKind(kind) ? catalogEntry(kind) : null;
}

export function componentToolId(kind: DiagramElementKind): ToolId {
  return `part:${kind}`;
}

export function catalogSurfacePreset(kind: DiagramElementKind): CatalogSurfacePreset | null {
  return kind in catalogSurfacePresets ? catalogSurfacePresets[kind as CatalogSurfaceKind] : null;
}

export function catalogSurfaceKind(direction: CatalogSurfacePreset["direction"], roughness: CatalogSurfacePreset["roughness"]): CatalogSurfaceKind {
  return `${roughness}-${direction}` as CatalogSurfaceKind;
}

export function catalogSurfaceDefaultRotation(direction: CatalogSurfacePreset["direction"]) {
  return direction === "wall" ? -90 : 0;
}

export function createDiagramElement(kind: DiagramElementKind, x: number, y: number, id = globalThis.crypto?.randomUUID?.() ?? `part-${Date.now()}-${Math.random().toString(36).slice(2)}`): DiagramElement {
  const definition = catalogEntry(kind);
  const surface = catalogSurfacePreset(kind);
  const rotation = kind === "gravity" ? 90
    : kind === "normal-force" || kind === "buoyancy" ? -90
      : surface ? catalogSurfaceDefaultRotation(surface.direction)
        : 0;
  return {
    endTargetId: null,
    fontSize: kind === "text" ? 18 : 22,
    height: definition.defaultHeight,
    id,
    kind,
    label: definition.defaultLabel,
    lineWidth: 2,
    locked: false,
    rotation,
    referenceTargetId: null,
    startTargetId: null,
    visible: true,
    width: definition.defaultWidth,
    x,
    y,
  };
}

function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/[\s・／/_-]/g, "");
}

export function searchComponentCatalog(query: string) {
  const needle = normalizeSearch(query);
  if (!needle) return [...PHYSICS_COMPONENT_CATALOG];
  return PHYSICS_COMPONENT_CATALOG.filter((item) =>
    [item.name, item.kind, item.defaultLabel, ...item.aliases, ...item.physics]
      .some((value) => normalizeSearch(value).includes(needle)),
  );
}
