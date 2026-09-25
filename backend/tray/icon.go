package tray

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"runtime"
	"sync"

	_ "embed"

	"github.com/rom5n/whitelist-download/backend/logging"
	"go.uber.org/zap"
)

//go:embed icon.ico
var iconWin []byte

//go:embed icon.png
var iconMac []byte

var pngSignature = []byte("\x89PNG\r\n\x1a\n")

var (
	iconCacheMu sync.Mutex
	iconCache   = make(map[iconKind][]byte)
)

// iconData returns the tray icon of the given kind for the current OS. The paused and error variants are
// generated from the regular icon on first use; if that fails, the regular icon is used.
func iconData(kind iconKind) []byte {
	regular := iconMac
	if runtime.GOOS == "windows" {
		regular = iconWin
	}

	if kind == iconNormal {
		return regular
	}

	iconCacheMu.Lock()
	defer iconCacheMu.Unlock()

	if data, ok := iconCache[kind]; ok {
		return data
	}

	transform := dimPNG
	if kind == iconError {
		transform = badgePNG
	}

	var data []byte
	var err error
	if runtime.GOOS == "windows" {
		data, err = transformICO(iconWin, transform)
	} else {
		data, err = transform(iconMac)
	}
	if err != nil {
		logging.Log.Warn("failed to build a tray icon variant, using the regular one", zap.Int("kind", int(kind)), zap.Error(err))
		data = regular
	}

	iconCache[kind] = data
	return data
}

func decodeNRGBA(data []byte) (*image.NRGBA, error) {
	src, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode png: %w", err)
	}

	bounds := src.Bounds()
	dst := image.NewNRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			dst.SetNRGBA(x, y, color.NRGBAModel.Convert(src.At(x, y)).(color.NRGBA))
		}
	}

	return dst, nil
}

func encodePNG(img image.Image) ([]byte, error) {
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		return nil, fmt.Errorf("failed to encode png: %w", err)
	}
	return out.Bytes(), nil
}

// dimPNG returns the PNG image converted to grayscale and made translucent.
func dimPNG(data []byte) ([]byte, error) {
	img, err := decodeNRGBA(data)
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := img.NRGBAAt(x, y)
			gray := uint8((299*uint32(c.R) + 587*uint32(c.G) + 114*uint32(c.B)) / 1000)
			img.SetNRGBA(x, y, color.NRGBA{R: gray, G: gray, B: gray, A: uint8(uint32(c.A) * 55 / 100)})
		}
	}

	return encodePNG(img)
}

var (
	badgeColor = color.NRGBA{R: 229, G: 72, B: 77, A: 255}
	ringColor  = color.NRGBA{R: 255, G: 255, B: 255, A: 255}
)

// Badge proportions, relative to the icon size.
const (
	badgeRadius = 0.2
	badgeRing   = 0.05
	badgeMargin = 0.02
)

// badgeGeometry returns the badge center and the radii of the dot and of the ring around it.
func badgeGeometry(bounds image.Rectangle) (cx, cy, radius, ring float64) {
	size := float64(min(bounds.Dx(), bounds.Dy()))
	radius = size * badgeRadius
	ring = math.Max(size*badgeRing, 0.7)
	cx = float64(bounds.Max.X) - radius - ring - size*badgeMargin
	cy = float64(bounds.Max.Y) - radius - ring - size*badgeMargin
	return cx, cy, radius, ring
}

// badgePNG returns the PNG image with a red dot with a white ring in the bottom right corner.
func badgePNG(data []byte) ([]byte, error) {
	img, err := decodeNRGBA(data)
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()
	cx, cy, radius, ring := badgeGeometry(bounds)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			distance := math.Hypot(float64(x)+0.5-cx, float64(y)+0.5-cy)

			// Anti-aliased edges: coverage falls from 1 to 0 across one pixel
			ringCoverage := clamp01(radius + ring + 0.5 - distance)
			fillCoverage := clamp01(radius + 0.5 - distance)
			if ringCoverage == 0 {
				continue
			}

			pixel := over(img.NRGBAAt(x, y), ringColor, ringCoverage)
			img.SetNRGBA(x, y, over(pixel, badgeColor, fillCoverage))
		}
	}

	return encodePNG(img)
}

func clamp01(v float64) float64 {
	return math.Min(math.Max(v, 0), 1)
}

// over draws the source color with the given coverage over the destination (non-premultiplied alpha).
func over(dst, src color.NRGBA, coverage float64) color.NRGBA {
	srcAlpha := float64(src.A) / 255 * coverage
	dstAlpha := float64(dst.A) / 255
	outAlpha := srcAlpha + dstAlpha*(1-srcAlpha)
	if outAlpha == 0 {
		return color.NRGBA{}
	}

	channel := func(s, d uint8) uint8 {
		return uint8(math.Round((float64(s)*srcAlpha + float64(d)*dstAlpha*(1-srcAlpha)) / outAlpha))
	}

	return color.NRGBA{R: channel(src.R, dst.R), G: channel(src.G, dst.G), B: channel(src.B, dst.B), A: uint8(math.Round(outAlpha * 255))}
}

// transformICO returns the ICO file with every PNG frame replaced by the result of transform.
func transformICO(data []byte, transform func([]byte) ([]byte, error)) ([]byte, error) {
	const headerSize, entrySize = 6, 16

	if len(data) < headerSize || binary.LittleEndian.Uint16(data[0:2]) != 0 || binary.LittleEndian.Uint16(data[2:4]) != 1 {
		return nil, errors.New("not an ico file")
	}

	count := int(binary.LittleEndian.Uint16(data[4:6]))
	if count == 0 || len(data) < headerSize+count*entrySize {
		return nil, errors.New("invalid ico directory")
	}

	entries := make([][]byte, count)
	frames := make([][]byte, count)
	for i := range count {
		entry := bytes.Clone(data[headerSize+i*entrySize : headerSize+(i+1)*entrySize])
		size := int(binary.LittleEndian.Uint32(entry[8:12]))
		offset := int(binary.LittleEndian.Uint32(entry[12:16]))
		if offset < 0 || size < 0 || offset+size > len(data) {
			return nil, fmt.Errorf("ico frame %d is out of bounds", i)
		}

		frame := data[offset : offset+size]
		if !bytes.HasPrefix(frame, pngSignature) {
			return nil, fmt.Errorf("ico frame %d is not a png", i)
		}

		transformed, err := transform(frame)
		if err != nil {
			return nil, fmt.Errorf("ico frame %d: %w", i, err)
		}

		entries[i] = entry
		frames[i] = transformed
	}

	out := bytes.NewBuffer(bytes.Clone(data[:headerSize]))
	offset := headerSize + count*entrySize
	for i := range count {
		binary.LittleEndian.PutUint32(entries[i][8:12], uint32(len(frames[i])))
		binary.LittleEndian.PutUint32(entries[i][12:16], uint32(offset))
		out.Write(entries[i])
		offset += len(frames[i])
	}
	for _, frame := range frames {
		out.Write(frame)
	}

	return out.Bytes(), nil
}
