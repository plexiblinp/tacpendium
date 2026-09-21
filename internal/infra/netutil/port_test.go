package netutil

import (
	"net"
	"testing"
)

// TestListenAvailable_FreePort は空きポートをそのまま採用することを確認する。
func TestListenAvailable_FreePort(t *testing.T) {
	// :0 で空きポートを 1 つ確保し、解放してからそのポートを起点に探索する。
	probe, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("probe listen: %v", err)
	}
	port := probe.Addr().(*net.TCPAddr).Port
	probe.Close()

	ln, got, err := ListenAvailable("127.0.0.1", port, 20)
	if err != nil {
		t.Fatalf("ListenAvailable: %v", err)
	}
	defer ln.Close()
	if got != port {
		t.Errorf("port = %d, want %d (free port should be used as-is)", got, port)
	}
}

// TestListenAvailable_FallbackOnConflict は起点ポートが使用中のとき次の空きを採用することを確認する。
func TestListenAvailable_FallbackOnConflict(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("occupy listen: %v", err)
	}
	defer occupied.Close()
	occupiedPort := occupied.Addr().(*net.TCPAddr).Port

	ln, got, err := ListenAvailable("127.0.0.1", occupiedPort, 50)
	if err != nil {
		t.Fatalf("ListenAvailable: %v", err)
	}
	defer ln.Close()
	if got == occupiedPort {
		t.Errorf("port = %d, want a different port (start port is occupied)", got)
	}
	if got < occupiedPort {
		t.Errorf("port = %d, want >= %d (sequential +1 search)", got, occupiedPort)
	}
}

// TestListenAvailable_Exhausted は試行範囲が尽きたときエラーを返すことを確認する。
func TestListenAvailable_Exhausted(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("occupy listen: %v", err)
	}
	defer occupied.Close()
	occupiedPort := occupied.Addr().(*net.TCPAddr).Port

	// 唯一の試行先(占有中ポート)のみを試す → 空きなしでエラー。
	ln, _, err := ListenAvailable("127.0.0.1", occupiedPort, 1)
	if err == nil {
		ln.Close()
		t.Fatal("expected error when the only candidate port is occupied")
	}
}
