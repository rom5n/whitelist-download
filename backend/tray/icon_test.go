package tray

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func decodePNG(t *testing.T, data []byte) image.Image {
	t.Helper()

	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("not a valid png: %v", err)
	}
	return img
}

func nrgba(img image.Image, x, y int) color.NRGBA {
	return color.NRGBAModel.Convert(img.At(x, y)).(color.NRGBA)
}

func TestDimPNG(t *testing.T) {
	dimmed, err := dimPNG(iconMac)
	if err != nil {
		t.Fatalf("dimPNG: %v", err)
	}

	src, dst := decodePNG(t, iconMac), decodePNG(t, dimmed)
	if src.Bounds() != dst.Bounds() {
		t.Fatalf("size changed from %v to %v", src.Bounds(), dst.Bounds())
	}

	opaque := 0
	for y := src.Bounds().Min.Y; y < src.Bounds().Max.Y; y++ {
		for x := src.Bounds().Min.X; x < src.Bounds().Max.X; x++ {
			s, d := nrgba(src, x, y), nrgba(dst, x, y)

			if d.R != d.G || d.G != d.B {
				t.Fatalf("pixel (%d,%d) is not gray: %+v", x, y, d)
			}
			if d.A > s.A {
				t.Fatalf("pixel (%d,%d) became more opaque: %d -> %d", x, y, s.A, d.A)
			}
			if s.A == 255 {
				opaque++
				if d.A >= 255 {
					t.Fatalf("opaque pixel (%d,%d) was not made translucent", x, y)
				}
			}
		}
	}
	if opaque == 0 {
		t.Log("the icon has no fully opaque pixels; translucency was not checked on them")
	}
}

func TestBadgePNG(t *testing.T) {
	badged, err := badgePNG(iconMac)
	if err != nil {
		t.Fatalf("badgePNG: %v", err)
	}

	src, dst := decodePNG(t, iconMac), decodePNG(t, badged)
	if src.Bounds() != dst.Bounds() {
		t.Fatalf("size changed from %v to %v", src.Bounds(), dst.Bounds())
	}
	b := src.Bounds()

	// The top left quarter is far from the badge and must stay as it was
	for y := b.Min.Y; y < b.Min.Y+b.Dy()/2; y++ {
		for x := b.Min.X; x < b.Min.X+b.Dx()/2; x++ {
			if s, d := nrgba(src, x, y), nrgba(dst, x, y); s != d {
				t.Fatalf("pixel (%d,%d) outside of the badge changed: %+v -> %+v", x, y, s, d)
			}
		}
	}

	// The badge center is red and opaque
	cx, cy, _, _ := badgeGeometry(b)
	got := nrgba(dst, int(cx), int(cy))
	if got != badgeColor {
		t.Errorf("badge center = %+v, want %+v", got, badgeColor)
	}
}

func TestTransformICO(t *testing.T) {
	for name, transform := range map[string]func([]byte) ([]byte, error){"dim": dimPNG, "badge": badgePNG} {
		t.Run(name, func(t *testing.T) {
			out, err := transformICO(iconWin, transform)
			if err != nil {
				t.Fatalf("transformICO: %v", err)
			}

			count := int(binary.LittleEndian.Uint16(iconWin[4:6]))
			if got := int(binary.LittleEndian.Uint16(out[4:6])); got != count {
				t.Fatalf("frames count changed from %d to %d", count, got)
			}

			for i := range count {
				orig := iconWin[6+i*16 : 6+(i+1)*16]
				entry := out[6+i*16 : 6+(i+1)*16]

				// Width, height, palette size, reserved, planes and bit depth must be preserved.
				if !bytes.Equal(orig[:8], entry[:8]) {
					t.Errorf("frame %d: directory entry header changed: %x -> %x", i, orig[:8], entry[:8])
				}

				size := int(binary.LittleEndian.Uint32(entry[8:12]))
				offset := int(binary.LittleEndian.Uint32(entry[12:16]))
				if offset+size > len(out) {
					t.Fatalf("frame %d is out of bounds", i)
				}

				img := decodePNG(t, out[offset:offset+size])
				if w := img.Bounds().Dx(); w != int(entry[0]) && (entry[0] != 0 || w != 256) {
					t.Errorf("frame %d: image width %d does not match the directory (%d)", i, w, entry[0])
				}
			}
		})
	}
}

func TestTransformICORejectsGarbage(t *testing.T) {
	for name, data := range map[string][]byte{"empty": nil, "not an ico": []byte("hello world, definitely not an icon"), "truncated": iconWin[:20]} {
		if _, err := transformICO(data, dimPNG); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestIconData(t *testing.T) {
	regular := iconData(iconNormal)
	if len(regular) == 0 {
		t.Fatal("no regular icon")
	}

	for _, kind := range []iconKind{iconPaused, iconError} {
		got := iconData(kind)
		if len(got) == 0 || bytes.Equal(got, regular) {
			t.Errorf("icon kind %d is empty or the same as the regular icon", kind)
		}
		if again := iconData(kind); !bytes.Equal(got, again) {
			t.Errorf("icon kind %d is not stable between calls", kind)
		}
	}
}
