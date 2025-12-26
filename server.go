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
	"time"
)

// Config структура конфигурации
type Config struct {
	Port      string
	UploadDir string
}

// Response структура ответа
type Response struct {
	Success  int    `json:"success,omitempty"`
	Uploaded int    `json:"uploaded,omitempty"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
}

var cfg Config

func init() {
	cfg = Config{
		// Port:      os.Getenv("UPT_PORT"),
		// UploadDir: os.Getenv("UPT_URL_PREFIX"),
		Port:      ":8080",
		UploadDir: "./uploads",
	}

	if err := os.MkdirAll(cfg.UploadDir, 0755); err != nil {
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

	log.Printf("🚀 Сервер запущен на http://localhost:%s", cfg.Port)
	log.Printf("📁 Директория загрузок: %s", cfg.UploadDir)

	// Запуск HTTP сервера
	if err := http.ListenAndServe(cfg.Port, nil); err != nil {
		log.Fatalf("Ошибка запуска сервера: %v", err)
	}
}

// Служит главную страницу
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
	r.ParseMultipartForm(500 << 20)

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
	cmd = exec.Command("lscpu")

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
	cmd = exec.Command("lscpu")

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
	cmd = exec.Command("lscpu")

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
	cmd = exec.Command("lscpu")

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
