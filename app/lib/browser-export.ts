function svgSize(svg: string) {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  const width = Number(root.getAttribute("width"));
  const height = Number(root.getAttribute("height"));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("SVGの寸法を読み取れません");
  return { document, height, root, width };
}

export async function svgToPngBlob(svg: string, scale = 2) {
  const { height, width } = svgSize(svg);
  const source = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG描画領域を作成できません");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNGを生成できません")), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function svgsToPdfBlob(svgs: readonly string[]) {
  if (!svgs.length) throw new Error("PDFへ出力する図がありません");
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const first = svgSize(svgs[0]);
  const pdf = new jsPDF({ format: [first.width, first.height], hotfixes: ["px_scaling"], orientation: first.width >= first.height ? "landscape" : "portrait", unit: "px" });
  for (const [index, svg] of svgs.entries()) {
    const { height, root, width } = svgSize(svg);
    if (index > 0) pdf.addPage([width, height], width >= height ? "landscape" : "portrait");
    await svg2pdf(root, pdf, { height, width, x: 0, y: 0 });
  }
  return pdf.output("blob");
}
