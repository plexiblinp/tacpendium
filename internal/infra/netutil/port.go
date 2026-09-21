package netutil

import (
	"fmt"
	"net"
)

// DefaultPortScanRange はポート競合時に試行する連番探索の最大本数(既定ポートから +N)。
const DefaultPortScanRange = 20

// ListenAvailable は host:startPort から順にポート番号を +1 しながら空きを探索し、
// 最初にリッスンできたポートの net.Listener と実際のポート番号を返す。
//
// DES-002 §3.3「起動時に当該ポートが使用中の場合は、次の空きポートを自動的に探索する」に対応する
// (持ち越し課題 L-04)。maxAttempts 回試行しても空きが見つからない場合はエラーを返す。
// 返した net.Listener は呼び出し側が利用・クローズする責務を負う。
func ListenAvailable(host string, startPort, maxAttempts int) (net.Listener, int, error) {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	var lastErr error
	for i := 0; i < maxAttempts; i++ {
		port := startPort + i
		if port > 65535 {
			break
		}
		ln, err := net.Listen("tcp", fmt.Sprintf("%s:%d", host, port))
		if err != nil {
			lastErr = err
			continue
		}
		return ln, port, nil
	}
	return nil, 0, fmt.Errorf("netutil: no available port in range %d-%d: %w", startPort, startPort+maxAttempts-1, lastErr)
}
