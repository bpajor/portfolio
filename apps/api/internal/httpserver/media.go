package httpserver

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	apidb "github.com/bpajor/portfolio/apps/api/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type mediaResponse struct {
	ID        string `json:"id"`
	Filename  string `json:"filename"`
	MimeType  string `json:"mimeType"`
	SizeBytes int64  `json:"sizeBytes"`
	AltText   string `json:"altText"`
	URL       string `json:"url"`
	CreatedAt string `json:"createdAt"`
}

type mediaAltTextRequest struct {
	AltText string `json:"altText"`
}

var allowedMediaMIMETypes = map[string]string{
	"image/gif":  ".gif",
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

func (s Server) getMedia(w http.ResponseWriter, r *http.Request) {
	if s.queries == nil {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}

	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	media, err := s.queries.GetMedia(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}
	if err != nil {
		s.logger.Error("get media failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_unavailable", "Media is temporarily unavailable.")
		return
	}

	path, ok := s.mediaFilePath(media.StoragePath)
	if !ok {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}

	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}
	if err != nil {
		s.logger.Error("open media file failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_unavailable", "Media is temporarily unavailable.")
		return
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		s.logger.Error("stat media file failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_unavailable", "Media is temporarily unavailable.")
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Type", media.MimeType)
	http.ServeContent(w, r, media.Filename, info.ModTime(), file)
}

func (s Server) adminListMedia(w http.ResponseWriter, r *http.Request) {
	media, err := s.queries.AdminListMedia(r.Context())
	if err != nil {
		s.logger.Error("admin list media failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_unavailable", "Media is temporarily unavailable.")
		return
	}

	out := make([]mediaResponse, 0, len(media))
	for _, item := range media {
		out = append(out, mediaModelToResponse(item))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s Server) adminUploadMedia(w http.ResponseWriter, r *http.Request) {
	if s.cfg.MediaMaxBytes <= 0 {
		writeError(w, http.StatusInternalServerError, "media_upload_unavailable", "Media uploads are not configured.")
		return
	}
	if err := r.ParseMultipartForm(s.cfg.MediaMaxBytes); err != nil {
		writeError(w, http.StatusBadRequest, "media_upload_invalid", "Media upload is invalid.")
		return
	}

	altText, ok := cleanMediaAltText(w, r.FormValue("altText"))
	if !ok {
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "media_file_required", "Image file is required.")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, s.cfg.MediaMaxBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "media_upload_invalid", "Media upload is invalid.")
		return
	}
	if int64(len(data)) > s.cfg.MediaMaxBytes {
		writeError(w, http.StatusBadRequest, "media_too_large", "Image file is too large.")
		return
	}

	mimeType := http.DetectContentType(data)
	extension, ok := allowedMediaMIMETypes[mimeType]
	if !ok {
		writeError(w, http.StatusBadRequest, "media_type_invalid", "Only PNG, JPEG, GIF, and WebP images can be uploaded.")
		return
	}

	filename := cleanUploadFilename(header.Filename)
	storagePath := uuid.NewString() + extension
	fullPath, ok := s.mediaFilePath(storagePath)
	if !ok {
		writeError(w, http.StatusInternalServerError, "media_upload_unavailable", "Media uploads are not configured.")
		return
	}
	if err := os.MkdirAll(s.cfg.MediaStorageDir, 0o755); err != nil {
		s.logger.Error("create media storage directory failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_upload_failed", "Media could not be uploaded.")
		return
	}
	if err := os.WriteFile(fullPath, data, 0o644); err != nil {
		s.logger.Error("write media file failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_upload_failed", "Media could not be uploaded.")
		return
	}

	media, err := s.queries.CreateMedia(r.Context(), apidb.CreateMediaParams{
		Filename:    filename,
		StoragePath: storagePath,
		MimeType:    mimeType,
		SizeBytes:   int64(len(data)),
		AltText:     altText,
	})
	if err != nil {
		_ = os.Remove(fullPath)
		s.logger.Error("create media metadata failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_upload_failed", "Media could not be uploaded.")
		return
	}

	writeJSON(w, http.StatusCreated, mediaModelToResponse(media))
}

func (s Server) adminUpdateMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	var req mediaAltTextRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body is invalid.")
		return
	}
	altText, ok := cleanMediaAltText(w, req.AltText)
	if !ok {
		return
	}

	media, err := s.queries.UpdateMediaAltText(r.Context(), apidb.UpdateMediaAltTextParams{
		ID:      id,
		AltText: altText,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}
	if err != nil {
		s.logger.Error("admin update media failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_update_failed", "Media could not be updated.")
		return
	}

	writeJSON(w, http.StatusOK, mediaModelToResponse(media))
}

func (s Server) adminDeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	media, err := s.queries.DeleteMedia(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "media_not_found", "Media was not found.")
		return
	}
	if err != nil {
		s.logger.Error("admin delete media failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_delete_failed", "Media could not be deleted.")
		return
	}

	if path, ok := s.mediaFilePath(media.StoragePath); ok {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			s.logger.Warn("delete media file failed", "error", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s Server) parseOptionalMediaID(w http.ResponseWriter, r *http.Request, raw *string) (pgtype.UUID, bool) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return pgtype.UUID{}, true
	}
	id, err := uuid.Parse(strings.TrimSpace(*raw))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_media_id", "Selected media is invalid.")
		return pgtype.UUID{}, false
	}
	if _, err := s.queries.GetMedia(r.Context(), id); errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "media_not_found", "Selected media was not found.")
		return pgtype.UUID{}, false
	} else if err != nil {
		s.logger.Error("validate post media failed", "error", err)
		writeError(w, http.StatusInternalServerError, "media_unavailable", "Media is temporarily unavailable.")
		return pgtype.UUID{}, false
	}
	return pgUUID(id), true
}

func cleanMediaAltText(w http.ResponseWriter, value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		writeError(w, http.StatusBadRequest, "alt_text_required", "Alt text is required.")
		return "", false
	}
	if len(value) > 300 {
		writeError(w, http.StatusBadRequest, "alt_text_too_long", "Alt text must be at most 300 characters.")
		return "", false
	}
	return value, true
}

func cleanUploadFilename(value string) string {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	value = filepath.Base(value)
	if value == "." || value == "/" || value == "" {
		return "image"
	}
	return value
}

func (s Server) mediaFilePath(storagePath string) (string, bool) {
	storagePath = strings.TrimSpace(storagePath)
	if storagePath == "" {
		return "", false
	}
	clean := filepath.Clean(storagePath)
	if filepath.IsAbs(clean) || clean != filepath.Base(clean) || strings.Contains(clean, "..") {
		return "", false
	}
	return filepath.Join(s.cfg.MediaStorageDir, clean), true
}

func mediaModelToResponse(media apidb.Medium) mediaResponse {
	id := media.ID.String()
	return mediaResponse{
		ID:        id,
		Filename:  media.Filename,
		MimeType:  media.MimeType,
		SizeBytes: media.SizeBytes,
		AltText:   media.AltText,
		URL:       "/api/media/" + id,
		CreatedAt: media.CreatedAt.Time.Format(time.RFC3339),
	}
}
