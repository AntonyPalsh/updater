package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

// Config структура конфигурации
type Config struct {
	Port       string
	UploadDir  string
	Update     string
	BackupAPP  string
	RestoreAPP string
	BackupBD   string
	LimitMB    int64
}

// Response структура ответа
type Response struct {
	Success  int    `json:"success,omitempty"`
	Uploaded int    `json:"uploaded,omitempty"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
}

var cfg Config

// Получаем значение по умолчанию, если не заданны переменные окружения
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func init() {

	// Проверяем корректность ввода значения limitMB
	limitMB, err := strconv.ParseInt(getEnv("UPT_LIMIT_DOWNLOAD_MB", "500"), 10, 64)
	if err != nil {
		log.Fatalf("Не корректный формат UPT_LIMIT_DOWNLOAD_MB: %v", err)
		return
	}

	cfg = Config{
		LimitMB:    limitMB,
		Port:       getEnv("UPT_PORT", ":8080"),
		UploadDir:  getEnv("UPT_URL_PREFIX", "./uploads"),
		Update:     getEnv("UPT_SC_UPDATE", "lscpu"),
		BackupAPP:  getEnv("UPT_SC_BACKUP_APP", "who"),
		RestoreAPP: getEnv("UPT_SC_RESTORE_APP", "vmstat"),
		BackupBD:   getEnv("UPT_SC_BACKUP_BD", "lsblk"),
	}

	if err := os.MkdirAll(cfg.UploadDir, 0750); err != nil {
		log.Fatalf("Ошибка создания директории: %v", err)
	}
}

func main() {
	// Статические файлы
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	// API endpoints
	http.HandleFunc("/", serveIndex)
	http.HandleFunc("/api/upload", uploadHandler)
	http.HandleFunc("/api/list", listHandler)
	http.HandleFunc("/api/update", updateHandler)
	http.HandleFunc("/api/backupAPP", backupAPPHandler)
	http.HandleFunc("/api/restoreAPP", restoreAPPHandler)
	http.HandleFunc("/api/backupBD", backupBDHandler)
	http.HandleFunc("/api/delete", deleteHandler)

	log.Printf("🚀 Сервер запущен на http://localhost:%s", cfg.Port)
	log.Printf("📁 Директория загрузок: %s", cfg.UploadDir)

	// Запуск HTTP сервера
	if err := http.ListenAndServe(cfg.Port, nil); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}

// Загрузка web страницы
func serveIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	file, err := os.Open("index.html")
	if err != nil {
		http.Error(w, "Файл не найден", http.StatusNotFound)
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(w, file)
}

// Обработка загрузки файлов
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	// Ограничиваем размер: 500 MB
	r.ParseMultipartForm(cfg.LimitMB << 20)

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Файлы не найдены"})
		return
	}

	uploaded := 0

	for _, fileHeader := range files {
		// Валидация имени файла
		filename := filepath.Base(fileHeader.Filename)
		if filename == "" || filename == "." || filename == ".." {
			continue
		}

		file, err := fileHeader.Open()
		if err != nil {
			log.Printf("Ошибка открытия файла: %v", err)
			continue
		}
		defer file.Close()

		// Сохраняем файл
		dst, err := os.Create(filepath.Join(cfg.UploadDir, filename))
		if err != nil {
			log.Printf("Ошибка создания файла: %v", err)
			continue
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			log.Printf("Ошибка копирования файла: %v", err)
			continue
		}

		uploaded++
		log.Printf("✓ Загружен файл: %s", filename)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Uploaded: uploaded})
}

func deleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	filename := r.FormValue("filename")
	if filename == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(Response{Error: "Имя файла не указано"})
		return
	}

	filename = filepath.Base(filename)
	filePath := filepath.Join(cfg.UploadDir, filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(Response{Error: "Файл не найден"})
		return
	}

	if err := os.Remove(filePath); err != nil {
		log.Printf("Ошибка удаления файла %s: %v", filename, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{Error: fmt.Sprintf("Ошибка удаления файла: %v", err)})
		return
	}

	log.Printf("✓ Файл удален: %s", filename)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Success: 1})
}

// Обработка команды ls -la
func listHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	var cmd *exec.Cmd
	// Выводим только дату изменения и имена файлов
	cmd = exec.Command("sh", "-c", fmt.Sprintf("ls -lh %q | awk '{print $5,$6,$7,$8,$9}'", cfg.UploadDir))

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Ошибка выполнения команды: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{
			Error:  fmt.Sprintf("Ошибка: %v", err),
			Output: string(output),
		})
		return
	}

	log.Printf("✓ Команда выполнена успешно")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Output: string(output)})
}

// Обработка команды update
func updateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	var cmd *exec.Cmd
	cmd = exec.Command(cfg.Update)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Ошибка выполнения команды: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{
			Error:  fmt.Sprintf("Ошибка: %v", err),
			Output: string(output),
		})
		return
	}

	log.Printf("✓ Команда lscpu выполнена успешно")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Output: string(output)})
}

// Обработка команды backup APP
func backupAPPHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	var cmd *exec.Cmd
	cmd = exec.Command(cfg.BackupAPP)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Ошибка выполнения команды: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{
			Error:  fmt.Sprintf("Ошибка: %v", err),
			Output: string(output),
		})
		return
	}

	log.Printf("✓ Команда lscpu выполнена успешно")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Output: string(output)})
}

// Обработка команды restore APP
func restoreAPPHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	var cmd *exec.Cmd
	cmd = exec.Command(cfg.RestoreAPP)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Ошибка выполнения команды: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{
			Error:  fmt.Sprintf("Ошибка: %v", err),
			Output: string(output),
		})
		return
	}

	log.Printf("✓ Команда lscpu выполнена успешно")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Output: string(output)})
}

// Обработка команды backup BD
func backupBDHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Response{Error: "Метод не поддерживается"})
		return
	}

	var cmd *exec.Cmd
	cmd = exec.Command(cfg.BackupBD)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Ошибка выполнения команды: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(Response{
			Error:  fmt.Sprintf("Ошибка: %v", err),
			Output: string(output),
		})
		return
	}

	log.Printf("✓ Команда lscpu выполнена успешно")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Output: string(output)})
}

// Middleware для логирования
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("[%s] %s %s", r.Method, r.RequestURI, time.Since(start))
		next.ServeHTTP(w, r)
	})
}
