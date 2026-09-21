// Command genicon writes internal/desktop/icon.ico — the notification-area
// icon for the resident mode (M34).
//
// Why a generator instead of a checked-in binary blob nobody can review: the
// icon is drawn from a few lines of code, so the .ico stays reproducible and
// self-authored (no third-party art, no licence question — CLAUDE.md ★).
//
// 使い方:
//
//	go run ./cmd/genicon > internal/desktop/icon.ico
//
// 絵柄: 濃紺の角丸パネルの上に青(#5b9dd9)の格子。移植元の絵柄をそのまま持ち込んで
// あり、本体の UI 配色とは対応していない。16x16 へ縮小されても形が潰れない程度の
// 粗さに留めてある。
//
// ★絵柄の差し替えは M34-02 の判断である(トレイが実際に出るのはそちら)。本ファイルを
// 書き換えて再生成すれば足りる。
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
)

const size = 32 // 32x32。トレイは 16x16 で描くので Windows 側で縮小される。

type rgba struct{ r, g, b, a uint8 }

var (
	transparent = rgba{}
	panelBG     = rgba{0x26, 0x28, 0x2e, 0xff} // 下地の濃紺
	gridLine    = rgba{0x5b, 0x9d, 0xd9, 0xff} // 格子の線
	cellFill    = rgba{0xe4, 0xe6, 0xeb, 0xff} // 格子の中の明るい面
)

func main() {
	px := draw()
	if err := writeICO(os.Stdout, px); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func draw() [size][size]rgba {
	var px [size][size]rgba
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			px[y][x] = transparent
		}
	}
	// 角を1px落とした四角い下地(角丸の代用。16px でも輪郭が潰れない)。
	const m = 2 // margin
	for y := m; y < size-m; y++ {
		for x := m; x < size-m; x++ {
			if (x == m || x == size-m-1) && (y == m || y == size-m-1) {
				continue // 四隅
			}
			px[y][x] = panelBG
		}
	}
	// 表の枠と罫線。外枠 + 縦2本 + 横2本 = 3x3 のセル。
	const g = 5 // grid margin
	for i := g; i < size-g; i++ {
		px[g][i] = gridLine
		px[size-g-1][i] = gridLine
		px[i][g] = gridLine
		px[i][size-g-1] = gridLine
	}
	for _, at := range []int{g + 7, g + 14} {
		for i := g; i < size-g; i++ {
			px[at][i] = gridLine // 横罫
			px[i][at] = gridLine // 縦罫
		}
	}
	// 先頭行を塗って「ヘッダのある表」に見せる。
	for y := g + 1; y < g+7; y++ {
		for x := g + 1; x < size-g-1; x++ {
			if x == g+7 || x == g+14 {
				continue
			}
			px[y][x] = cellFill
		}
	}
	return px
}

// writeICO emits a single-image 32bpp ICO (BITMAPINFOHEADER + BGRA XOR mask +
// 1bpp AND mask). The AND mask is required by the format even for 32bpp icons.
func writeICO(w *os.File, px [size][size]rgba) error {
	var xor bytes.Buffer
	for y := size - 1; y >= 0; y-- { // DIB は下から上
		for x := 0; x < size; x++ {
			p := px[y][x]
			xor.Write([]byte{p.b, p.g, p.r, p.a})
		}
	}
	var and bytes.Buffer
	rowBytes := ((size + 31) / 32) * 4 // 4byte 境界
	for y := size - 1; y >= 0; y-- {
		row := make([]byte, rowBytes)
		for x := 0; x < size; x++ {
			if px[y][x].a == 0 {
				row[x/8] |= 0x80 >> (x % 8) // 1 = 透過
			}
		}
		and.Write(row)
	}

	var img bytes.Buffer
	hdr := struct {
		Size                         uint32
		Width, Height                int32
		Planes, BitCount             uint16
		Compression, SizeImage       uint32
		XPelsPerMeter, YPelsPerMeter int32
		ClrUsed, ClrImportant        uint32
	}{Size: 40, Width: size, Height: size * 2, Planes: 1, BitCount: 32}
	if err := binary.Write(&img, binary.LittleEndian, hdr); err != nil {
		return err
	}
	img.Write(xor.Bytes())
	img.Write(and.Bytes())

	var out bytes.Buffer
	binary.Write(&out, binary.LittleEndian, uint16(0))  // reserved
	binary.Write(&out, binary.LittleEndian, uint16(1))  // type = icon
	binary.Write(&out, binary.LittleEndian, uint16(1))  // image count
	out.Write([]byte{size, size, 0, 0})                 // w, h, colour count, reserved
	binary.Write(&out, binary.LittleEndian, uint16(1))  // planes
	binary.Write(&out, binary.LittleEndian, uint16(32)) // bit count
	binary.Write(&out, binary.LittleEndian, uint32(img.Len()))
	binary.Write(&out, binary.LittleEndian, uint32(22)) // 画像データの開始オフセット
	out.Write(img.Bytes())

	_, err := w.Write(out.Bytes())
	return err
}
