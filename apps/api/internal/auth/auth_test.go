package auth

import "testing"

func TestPasswordHashRoundTrip(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if hash == "correct horse battery staple" {
		t.Fatal("password hash should not equal the raw password")
	}
	if !CheckPassword(hash, "correct horse battery staple") {
		t.Fatal("CheckPassword rejected the original password")
	}
	if CheckPassword(hash, "wrong password") {
		t.Fatal("CheckPassword accepted an incorrect password")
	}
}

func TestSessionTokenAndHashToken(t *testing.T) {
	token, err := NewSessionToken()
	if err != nil {
		t.Fatalf("NewSessionToken failed: %v", err)
	}
	if len(token) < 40 {
		t.Fatalf("session token length = %d, want at least 40", len(token))
	}

	hash := HashToken(token)
	if len(hash) != 64 {
		t.Fatalf("token hash length = %d, want 64", len(hash))
	}
	if hash != HashToken(token) {
		t.Fatal("HashToken should be deterministic for the same token")
	}
	if hash == HashToken(token+"x") {
		t.Fatal("HashToken should change when token changes")
	}
}
