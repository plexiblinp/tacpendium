package netutil

import (
	"net"
	"testing"
)

func TestIsVirtualInterface(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		{"docker0", true},
		{"veth1234", true},
		{"br-abc123", true},
		{"vEthernet (Default Switch)", true},
		{"tailscale0", true},
		{"tun0", true},
		{"tap0", true},
		{"vmnet1", true},
		{"vboxnet0", true},
		{"utun3", true},
		{"ppp0", true},
		{"zt-abc", true},
		{"DOCKER1", true}, // 大文字も判定
		{"eth0", false},
		{"wlan0", false},
		{"en0", false},
		{"enp3s0", false},
		{"lo", false},
	}
	for _, c := range cases {
		got := IsVirtualInterface(c.name)
		if got != c.want {
			t.Errorf("IsVirtualInterface(%q) = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestIsPrivateIPv4(t *testing.T) {
	cases := []struct {
		ip   string
		want bool
	}{
		// プライベート範囲
		{"10.0.0.1", true},
		{"10.255.255.254", true},
		{"172.16.0.1", true},
		{"172.31.255.254", true},
		{"172.20.5.5", true},
		{"192.168.0.1", true},
		{"192.168.1.10", true},
		{"169.254.1.2", true},
		// 範囲外
		{"172.15.0.1", false}, // 172.16 の手前
		{"172.32.0.1", false}, // 172.31 の後ろ
		{"8.8.8.8", false},    // パブリック
		{"100.64.0.1", false}, // CGNAT
		{"100.127.255.255", false},
		{"127.0.0.1", false}, // ループバック
		{"0.0.0.0", false},
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		if ip == nil {
			t.Fatalf("ParseIP(%q) returned nil", c.ip)
		}
		got := IsPrivateIPv4(ip)
		if got != c.want {
			t.Errorf("IsPrivateIPv4(%q) = %v, want %v", c.ip, got, c.want)
		}
	}
}

func TestIsPrivateIPv4_IPv6Unspecified(t *testing.T) {
	if IsPrivateIPv4(net.ParseIP("fe80::1")) {
		t.Error("IPv6 link-local should be false")
	}
}

func TestSelectByPriority(t *testing.T) {
	ip := func(s string) net.IP { return net.ParseIP(s) }

	t.Run("empty returns nil", func(t *testing.T) {
		if got := selectByPriority(nil); got != nil {
			t.Errorf("got %v, want nil", got)
		}
	})

	t.Run("only 192 returns 192", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("192.168.1.10")})
		if !got.Equal(ip("192.168.1.10")) {
			t.Errorf("got %v, want 192.168.1.10", got)
		}
	})

	t.Run("192 wins over 10", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("10.0.0.5"), ip("192.168.1.10")})
		if !got.Equal(ip("192.168.1.10")) {
			t.Errorf("got %v, want 192.168.1.10", got)
		}
	})

	t.Run("10 wins over 172", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("172.20.0.5"), ip("10.0.0.5")})
		if !got.Equal(ip("10.0.0.5")) {
			t.Errorf("got %v, want 10.0.0.5", got)
		}
	})

	t.Run("172 fallback when only 172", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("172.20.0.5")})
		if !got.Equal(ip("172.20.0.5")) {
			t.Errorf("got %v, want 172.20.0.5", got)
		}
	})

	t.Run("first within same priority wins", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("192.168.1.10"), ip("192.168.2.20")})
		if !got.Equal(ip("192.168.1.10")) {
			t.Errorf("got %v, want first 192.168.1.10", got)
		}
	})

	t.Run("ignores out-of-range entries", func(t *testing.T) {
		// classify が prioOut を返す場合は best にならない。
		got := selectByPriority([]net.IP{ip("8.8.8.8"), ip("192.168.1.10")})
		if !got.Equal(ip("192.168.1.10")) {
			t.Errorf("got %v, want 192.168.1.10", got)
		}
	})

	t.Run("vbox range is fallback only when nothing else available", func(t *testing.T) {
		// VirtualBox 既定範囲(192.168.56.0/24)単独 → 候補が他になければ採用される。
		got := selectByPriority([]net.IP{ip("192.168.56.5")})
		if !got.Equal(ip("192.168.56.5")) {
			t.Errorf("got %v, want 192.168.56.5 (fallback)", got)
		}
	})

	t.Run("vbox range loses to other 192", func(t *testing.T) {
		// 192.168.56.x は 192.168.1.x より優先度が低いので後者が選ばれる。
		got := selectByPriority([]net.IP{ip("192.168.56.5"), ip("192.168.1.10")})
		if !got.Equal(ip("192.168.1.10")) {
			t.Errorf("got %v, want 192.168.1.10 (vbox demoted below other 192)", got)
		}
	})

	t.Run("vbox range loses to 10/8", func(t *testing.T) {
		// vbox(prioVbox) は 10/8(prio10) より低い。10/8 が勝つ。
		got := selectByPriority([]net.IP{ip("192.168.56.5"), ip("10.0.0.5")})
		if !got.Equal(ip("10.0.0.5")) {
			t.Errorf("got %v, want 10.0.0.5 (vbox demoted below 10/8)", got)
		}
	})

	t.Run("vbox range loses to 172.16-31", func(t *testing.T) {
		// vbox(prioVbox) は 172.16-31(prio172) より低い。172 が勝つ。
		got := selectByPriority([]net.IP{ip("192.168.56.5"), ip("172.20.0.5")})
		if !got.Equal(ip("172.20.0.5")) {
			t.Errorf("got %v, want 172.20.0.5 (vbox demoted below 172)", got)
		}
	})

	t.Run("vbox boundary: 192.168.55 is normal 192", func(t *testing.T) {
		// 56.0/24 の境界外(192.168.55.x)は通常の prio192。
		got := selectByPriority([]net.IP{ip("192.168.55.5"), ip("10.0.0.5")})
		if !got.Equal(ip("192.168.55.5")) {
			t.Errorf("got %v, want 192.168.55.5 (not in vbox range)", got)
		}
	})

	t.Run("vbox boundary: 192.168.57 is normal 192", func(t *testing.T) {
		got := selectByPriority([]net.IP{ip("192.168.57.5"), ip("10.0.0.5")})
		if !got.Equal(ip("192.168.57.5")) {
			t.Errorf("got %v, want 192.168.57.5 (not in vbox range)", got)
		}
	})
}

func TestListPrivateIPv4_DoesNotError(t *testing.T) {
	// OS 依存のため戻り値の中身は検証しない。エラーにならないことだけ確認。
	if _, err := ListPrivateIPv4(); err != nil {
		t.Errorf("ListPrivateIPv4 returned error: %v", err)
	}
}
