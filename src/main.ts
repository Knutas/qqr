import { QrCode, QrSegment } from "./qrcodegen.js";

function init() {
    fillInputFromUrl();

    window.addEventListener("hashchange", () => {
        fillInputFromUrl();
        redrawQrCode();
    });

    getElem("qrcode-canvas").addEventListener("click", toggleFullscreen);
    getElem("qrcode-svg").addEventListener("click", toggleFullscreen);

    document.querySelectorAll(
        "input, textarea",
    ).forEach((el) => {
        el.addEventListener("input", redrawQrCode);
    });

    document.querySelector("form")!.addEventListener(
        "submit",
        (e) => e.preventDefault(),
    );

    redrawQrCode();
}

function fillInputFromUrl() {
    const textarea = document.querySelector("textarea")!;
    const download = getElem<HTMLAnchorElement>("download");
    const urlParam = window.location.hash.substring(1);

    if (urlParam && textarea.previousElementSibling !== download) {
        download.after(textarea);
    }

    textarea.value = decodeURIComponent(urlParam);
}

function toggleFullscreen(e: Event) {
    const target = e.currentTarget as HTMLElement;
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        target?.requestFullscreen();
    }
}

function redrawQrCode(e?: Event) {
    const sourceId = (e?.target as Element | null)?.id;
    if (sourceId === "version-min-input" || sourceId === "version-max-input") {
        handleVersionMinMax(sourceId === "version-min-input" ? "min" : "max");
    }

    const data = new FormData(document.querySelector("form")!);

    const bitmapOutput = data.get("output-format") === "bitmap";
    const scaleRow = getElem<HTMLElement>("scale-row");
    scaleRow.hidden = !bitmapOutput;
    let download = getElem<HTMLAnchorElement>("download");
    download.download = "qr-code." + (bitmapOutput ? "png" : "svg");
    download.removeAttribute("href");

    const canvas = getElem<HTMLCanvasElement>("qrcode-canvas");
    const svg = getElem("qrcode-svg");
    canvas.hidden = true;
    svg.setAttribute("hidden", "hidden");

    const ecl = getInputErrorCorrectionLevel(data);
    const text = data.get("text") as string;
    const segs = QrSegment.makeSegments(text);
    const minVer = parseInt(data.get("version-min") as string, 10);
    const maxVer = parseInt(data.get("version-max") as string, 10);
    const mask = parseInt(data.get("mask") as string, 10);
    const boostEcc = data.get("boost-ecc") === "true";
    const qr = QrCode.encodeSegments(
        segs,
        ecl,
        minVer,
        maxVer,
        mask,
        boostEcc,
    );

    const border = parseInt(data.get("border") as string, 10);
    if (border < 0 || border > 100) {
        return;
    }

    const lightColor = data.get("light-color") as string;
    const darkColor = data.get("dark-color") as string;

    if (bitmapOutput) {
        const scale = parseInt(data.get("scale") as string, 10);
        if (scale <= 0 || scale > 30) {
            return;
        }

        drawCanvas(qr, scale, border, lightColor, darkColor, canvas);
        canvas.hidden = false;
        download.href = canvas.toDataURL("image/png");
    } else {
        const code = toSvgString(qr, border, lightColor, darkColor);
        const viewBox = code.match(/ viewBox="([^"]*)"/)![1];
        const pathD = code.match(/ d="([^"]*)"/)![1];
        svg.setAttribute("viewBox", viewBox);
        svg.querySelector("path")!.setAttribute("d", pathD);
        svg.querySelector("rect")!.setAttribute("fill", lightColor);
        svg.querySelector("path")!.setAttribute("fill", darkColor);
        svg.removeAttribute("hidden");
        download.href = "data:application/svg+xml," + encodeURIComponent(code);
    }

    getElem("details-output").innerHTML =
        `<dt>QR Code version</dt><dd>${qr.version}</dd>
        <dt>Mask pattern</dt><dd>${qr.mask}</dd>
        <dt>Character count</dt><dd>${countUnicodeChars(text)}</dd>
        <dt>Encoding mode</dt><dd>${describeSegments(segs)}</dd>
        <dt>Error correction</dt><dd>${
            describeErrorCorrectionLevel(qr.errorCorrectionLevel.ordinal)
        }</dd>
        <dt>Data bits</dt><dd>${QrSegment.getTotalBits(segs, qr.version)}</dd>`;
}

function getInputErrorCorrectionLevel(data: FormData) {
    switch (data.get("errcorlvl")) {
        case "medium":
            return QrCode.Ecc.MEDIUM;
        case "quartile":
            return QrCode.Ecc.QUARTILE;
        case "high":
            return QrCode.Ecc.HIGH;
        default:
            return QrCode.Ecc.LOW;
    }
}

function countUnicodeChars(str: string) {
    let result = 0;
    for (const ch of str) {
        const cc = ch.codePointAt(0);
        if (cc === undefined) {
            throw new RangeError("Invalid UTF-16 string");
        }

        if (0xD800 <= cc && cc < 0xE000) {
            throw new RangeError("Invalid UTF-16 string");
        }

        result++;
    }

    return result;
}

function describeSegments(segs: Array<QrSegment>) {
    if (segs.length == 0) {
        return "none";
    } else if (segs.length == 1) {
        const mode = segs[0].mode;
        if (mode == QrSegment.Mode.NUMERIC) return "numeric";
        if (mode == QrSegment.Mode.ALPHANUMERIC) return "alphanumeric";
        if (mode == QrSegment.Mode.BYTE) return "byte";
        if (mode == QrSegment.Mode.KANJI) return "kanji";
        return "unknown";
    } else {
        return "multiple";
    }
}

function describeErrorCorrectionLevel(ordinal: number) {
    return `level "${"LMQH".charAt(ordinal)}"`;
}

function drawCanvas(
    qr: QrCode,
    scale: number,
    border: number,
    lightColor: string,
    darkColor: string,
    canvas: HTMLCanvasElement,
) {
    if (scale <= 0 || border < 0) {
        throw new RangeError("Value out of range");
    }

    const width = (qr.size + border * 2) * scale;
    canvas.width = width;
    canvas.height = width;
    let ctx = canvas.getContext("2d")!;
    for (let y = -border; y < qr.size + border; y++) {
        for (let x = -border; x < qr.size + border; x++) {
            ctx.fillStyle = qr.getModule(x, y) ? darkColor : lightColor;
            ctx.fillRect(
                (x + border) * scale,
                (y + border) * scale,
                scale,
                scale,
            );
        }
    }
}

function toSvgString(
    qr: QrCode,
    border: number,
    lightColor: string,
    darkColor: string,
) {
    if (border < 0) {
        throw new RangeError("Border must be non-negative");
    }

    let parts: Array<string> = [];
    for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
            if (qr.getModule(x, y)) {
                parts.push(`M${x + border},${y + border}h1v1h-1z`);
            }
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${
        qr.size + border * 2
    } ${qr.size + border * 2}" stroke="none">
	<rect width="100%" height="100%" fill="${lightColor}"/>
	<path d="${parts.join(" ")}" fill="${darkColor}"/>
</svg>
`;
}

function handleVersionMinMax(which: "min" | "max") {
    const minElem = getElem<HTMLInputElement>("version-min-input");
    const maxElem = getElem<HTMLInputElement>("version-max-input");
    let minVal = parseInt(minElem.value, 10);
    let maxVal = parseInt(maxElem.value, 10);
    minVal = Math.max(Math.min(minVal, QrCode.MAX_VERSION), QrCode.MIN_VERSION);
    maxVal = Math.max(Math.min(maxVal, QrCode.MAX_VERSION), QrCode.MIN_VERSION);

    if (which == "min" && minVal > maxVal) {
        maxVal = minVal;
    } else if (which == "max" && maxVal < minVal) {
        minVal = maxVal;
    }

    minElem.value = minVal.toString();
    maxElem.value = maxVal.toString();
}

function getElem<T extends Element = Element>(id: string): T {
    const result = document.querySelector(`#${id}`);
    if (result instanceof Element) {
        return result as T;
    }

    throw new Error("Assertion error");
}

init();
