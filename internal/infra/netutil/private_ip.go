// Package netutil はネットワークインタフェース列挙と LAN 用代表 IP の選定を提供する。
//
// 設計参照: SUPP-001 §2.6.2(QRコードIP選定 = 代表IP決定ロジック)。
// 仮想NICの除外、CGNATの除外、優先順位(192.168 > 10 > 172.16-31)を実装する。
package netutil

import (
	"errors"
	"fmt"
	"net"
	"strings"
)

// virtualPrefixes は仮想NIC判定用の名前先頭一致パターン。SUPP-001 §2.6.2 より。
var virtualPrefixes = []string{
	"docker",
	"veth",
	"br-",
	"vEthernet",
	"tailscale",
	"tun",
	"tap",
	"vmnet",
	"vboxnet",
	"utun",
	"ppp",
	"zt",
}

// IsVirtualInterface はインタフェース名から仮想 NIC か判定する。
// 大文字小文字は区別しない(Windows の "vEthernet (...)" 等を吸収)。
func IsVirtualInterface(name string) bool {
	lower := strings.ToLower(name)
	for _, p := range virtualPrefixes {
		if strings.HasPrefix(lower, strings.ToLower(p)) {
			return true
		}
	}
	return false
}

// CGNAT 範囲 100.64.0.0/10。Tailscale 等で使われる。
var cgnatNet = &net.IPNet{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)}

// IsPrivateIPv4 は IPv4 アドレスが本アプリで「LAN として扱う」プライベート範囲か判定する。
// RFC1918(10/8、172.16/12、192.168/16)と 169.254/16 を true、
// CGNAT(100.64/10)・ループバック・パブリックは false。
func IsPrivateIPv4(ip net.IP) bool {
	v4 := ip.To4()
	if v4 == nil {
		return false
	}
	if v4.IsLoopback() {
		return false
	}
	if cgnatNet.Contains(v4) {
		return false
	}
	switch {
	case v4[0] == 10:
		return true
	case v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31:
		return true
	case v4[0] == 192 && v4[1] == 168:
		return true
	case v4[0] == 169 && v4[1] == 254:
		return true
	}
	return false
}

// ListPrivateIPv4 は仮想NIC・ループバック・無効化IFを除外した
// プライベート IPv4 アドレス一覧を返す(インタフェース列挙順を維持)。
func ListPrivateIPv4() ([]net.IP, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, fmt.Errorf("netutil: list interfaces: %w", err)
	}
	var result []net.IP
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if IsVirtualInterface(iface.Name) {
			continue
		}
		addrs, addrErr := iface.Addrs()
		if addrErr != nil {
			continue
		}
		for _, a := range addrs {
			ip := ipFromAddr(a)
			if ip == nil {
				continue
			}
			v4 := ip.To4()
			if v4 == nil {
				continue
			}
			if !IsPrivateIPv4(v4) {
				continue
			}
			result = append(result, v4)
		}
	}
	return result, nil
}

func ipFromAddr(a net.Addr) net.IP {
	switch v := a.(type) {
	case *net.IPNet:
		return v.IP
	case *net.IPAddr:
		return v.IP
	}
	return nil
}

// ErrNoLANIP は LAN 用に選択可能な代表 IP が見つからなかったことを示す。
var ErrNoLANIP = errors.New("netutil: no LAN IPv4 available")

// SelectPrimaryLANIP は ListPrivateIPv4 の結果から優先順位に従い代表 IP 1 件を返す。
//
// 優先順位(SUPP-001 §2.6.2):
//  1. 192.168.0.0/16
//  2. 10.0.0.0/8
//  3. 172.16.0.0/12
//
// 同一優先度内では最初に見つかったものを採用。候補ゼロのときは ErrNoLANIP を返す。
func SelectPrimaryLANIP() (net.IP, error) {
	ips, err := ListPrivateIPv4()
	if err != nil {
		return nil, err
	}
	ip := selectByPriority(ips)
	if ip == nil {
		return nil, ErrNoLANIP
	}
	return ip, nil
}

// vboxNet は VirtualBox 既定の host-only ネットワーク 192.168.56.0/24。
// SUPP-001 §2.6.2 の「VM/コンテナ用と判明している範囲は優先度最下位まで落とす(除外はしない、手動指定用途のため残す)」に対応。
var vboxNet = &net.IPNet{IP: net.IPv4(192, 168, 56, 0), Mask: net.CIDRMask(24, 32)}

// selectByPriority は内部の純粋関数として優先順位選定を行う(テスト容易性のため切出し)。
//
// 優先順位:
//  1. prio192   = 192.168.0.0/16(VirtualBox 既定 192.168.56.0/24 を除く)
//  2. prio10    = 10.0.0.0/8
//  3. prio172   = 172.16.0.0/12
//  4. prioVbox  = 192.168.56.0/24(VirtualBox 既定。手動選択用途で候補は残すが優先度は最下位の直前)
//  5. prioOut   = 範囲外(候補にしない)
func selectByPriority(ips []net.IP) net.IP {
	const (
		prio192  = 1
		prio10   = 2
		prio172  = 3
		prioVbox = 4
		prioOut  = 5
	)
	classify := func(ip net.IP) int {
		v4 := ip.To4()
		if v4 == nil {
			return prioOut
		}
		switch {
		case v4[0] == 192 && v4[1] == 168:
			if vboxNet.Contains(v4) {
				return prioVbox
			}
			return prio192
		case v4[0] == 10:
			return prio10
		case v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31:
			return prio172
		}
		return prioOut
	}

	bestPrio := prioOut + 1
	var best net.IP
	for _, ip := range ips {
		p := classify(ip)
		if p < bestPrio {
			bestPrio = p
			best = ip
		}
	}
	return best
}
