import React, { useState, useRef, useEffect } from "react";
import s from "./Pdf.module.css";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Ініціалізація Firestore та Auth (припускаємо, що Firebase вже ініціалізовано)
const db = getFirestore();
const auth = getAuth();

const Pdf = () => {
  // Placeholder-значення для keywords, якщо API не поверне дані
  const placeholderKeywords = ["Keyword 1", "Keyword 2", "Keyword 3"];

  // Стан для показу попапу копіювання
  const [copyPopupVisible, setCopyPopupVisible] = useState(false);
  // Стан для показу сповіщення про завантаження (успіх/помилка)
  const [uploadPopup, setUploadPopup] = useState({
    visible: false,
    message: "",
    type: "success", // "success" або "error"
  });
  // Стан для історії запитів
  const [history, setHistory] = useState([]);

  // Завантаження збереженої історії з localStorage при монтуванні компонента
  useEffect(() => {
    const storedHistory = localStorage.getItem("pdfHistory");
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  // Збереження історії в localStorage щоразу, коли вона оновлюється
  useEffect(() => {
    localStorage.setItem("pdfHistory", JSON.stringify(history));
  }, [history]);

  // Функція копіювання тексту з попапом
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Text copied successfully!");
      setCopyPopupVisible(true);
      setTimeout(() => {
        setCopyPopupVisible(false);
      }, 3000);
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  // Функція збереження запису історії у Firestore
  const saveHistoryEntry = async (filename, summarySnippet) => {
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, "history"), {
          uid: auth.currentUser.uid,
          filename,
          summary: summarySnippet,
          timestamp: new Date(),
        });
        console.log("History saved in Firestore");
      } catch (err) {
        console.error("Error saving history entry:", err);
      }
    } else {
      console.error("User not authenticated");
    }
  };

  // Стан для вибору алгоритму обробки
  const [algorithm, setAlgorithm] = useState("GPT Algorithm");
  const handleAlgorithmChange = (e) => {
    setAlgorithm(e.target.value);
  };

  // Стан для модального вікна History
  const [showHistory, setShowHistory] = useState(false);
  const handleHistoryClick = () => {
    setShowHistory(!showHistory);
  };

  // Стан для роботи із завантаженим файлом
  const [selectedFile, setSelectedFile] = useState(null);
  // Стан для збереження даних з API: pdfSummary, keyTopics, keywords
  const [summaryData, setSummaryData] = useState({
    summary: "Generated summary will appear here...",
    highlights: [
      "Приміром, тут якісь дефолтні пункти",
      "Інший дефолтний пункт",
    ],
    keywords: [],
  });
  const [loadingFile, setLoadingFile] = useState(false);

  // Ref для прихованого input[type="file"]
  const fileInputRef = useRef(null);

  // Відкриття вікна вибору файлу
  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Обробка вибору файлу
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Автоматичне завантаження файлу
      handleFileUpload(file);
    }
  };

  // Завантаження файлу на API
  const handleFileUpload = async (file) => {
    setLoadingFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        "http://63.176.101.250/api/v1/summarize/pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", errorText);
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      // Якщо keyTopics приходять у форматі [{0: "..."}], беремо перше значення об'єкта
      const highlightsArr = Array.isArray(data.keyTopics)
        ? data.keyTopics.map((item) => {
            const firstKey = Object.keys(item)[0];
            return item[firstKey];
          })
        : [];

      // Аналогічно для keywords
      const keywordsArr = Array.isArray(data.keywords)
        ? data.keywords.map((obj) => {
            const firstKey = Object.keys(obj)[0];
            return obj[firstKey];
          })
        : [];

      // Збереження даних відповіді
      setSummaryData({
        summary: data.pdfSummary || "No summary provided",
        highlights: highlightsArr,
        keywords: keywordsArr,
      });

      // Отримуємо перше речення з отриманого резюме
      const firstSentence =
        data.pdfSummary && data.pdfSummary.length > 0
          ? data.pdfSummary.split(".")[0] + "."
          : "No summary available";

      // Оновлюємо локальну історію
      const newHistoryEntry = {
        filename: file.name,
        summary: firstSentence,
        timestamp: new Date(),
      };
      setHistory((prev) => [newHistoryEntry, ...prev]);

      // Зберігаємо історію у Firestore
      saveHistoryEntry(file.name, firstSentence);

      // Показ сповіщення про успіх
      setUploadPopup({
        visible: true,
        message: "File uploaded successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error uploading file:", error);

      // Встановлюємо дані для невдалого завантаження
      setSummaryData({
        summary: "Error loading summary.",
        highlights: ["Error loading highlights."],
        keywords: ["Error loading keywords."],
      });

      // Записуємо історію з інформацією про помилку
      const errorHistoryEntry = {
        filename: file.name,
        summary: "Error loading summary.",
        timestamp: new Date(),
      };
      setHistory((prev) => [errorHistoryEntry, ...prev]);
      saveHistoryEntry(file.name, "Error loading summary.");

      // Показ сповіщення про помилку
      setUploadPopup({
        visible: true,
        message: "Error uploading file!",
        type: "error",
      });
    } finally {
      setLoadingFile(false);
      // Ховаємо попап через 3 секунди
      setTimeout(() => {
        setUploadPopup({ visible: false, message: "", type: "success" });
      }, 3000);
    }
  };

  // Якщо API не повернуло keywords – використаємо placeholder
  const keywordsToShow =
    summaryData.keywords && summaryData.keywords.length > 0
      ? summaryData.keywords
      : placeholderKeywords;

  return (
    <div className={s.pageContainer}>
      {/* Попап копіювання */}
      {copyPopupVisible && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "10px",
            backgroundColor: "black",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            zIndex: 1000,
          }}
        >
          Copied!
        </div>
      )}

      {/* Попап завантаження */}
      {uploadPopup.visible && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            backgroundColor: uploadPopup.type === "error" ? "red" : "green",
            color: "white",
            padding: "10px 20px",
            borderRadius: "5px",
            zIndex: 1000,
          }}
        >
          {uploadPopup.message}
        </div>
      )}

      {/* Верхній рядок: Заголовок та History */}
      <div className={s.headerRow}>
        <h2 className={s.title}>Upload Document</h2>
        <button className={s.historyBtn} onClick={handleHistoryClick}>
          History
        </button>
      </div>

      {/* Блок для завантаження файлу */}
      <div className={s.uploadCard}>
        <div className={s.dropArea} onClick={handleChooseFile}>
          <p>Drag and drop your file here or</p>
          <button
            className={s.chooseFileBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleChooseFile();
            }}
          >
            Choose File
          </button>
          <p className={s.formatsText}>Supported formats: PDF, DOCX, TXT</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
        {loadingFile && <p>Processing file...</p>}
      </div>

      {/* Summary (pdfSummary) */}
      <div className={s.infoCard}>
        <div
          className={s.copyIcon}
          onClick={() => handleCopy(summaryData.summary)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M10 1H2a1 1 0 0 0-1 1v11h1V2h8V1zm5 2H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 11H6V5h8v9z" />
          </svg>
        </div>
        <h3 className={s.infoTitle}>Summary</h3>
        <p className={s.infoText}>{summaryData.summary}</p>
      </div>

      {/* Highlights (keyTopics) */}
      <div className={s.infoCard}>
        <div
          className={s.copyIcon}
          onClick={() => handleCopy(summaryData.highlights.join(", "))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M10 1H2a1 1 0 0 0-1 1v11h1V2h8V1zm5 2H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 11H6V5h8v9z" />
          </svg>
        </div>
        <h3 className={s.infoTitle}>Highlights</h3>
        {summaryData.highlights && summaryData.highlights.length > 0 ? (
          <ul>
            {summaryData.highlights.map((item, index) => (
              <li key={index}>- {item}</li>
            ))}
          </ul>
        ) : (
          <p className={s.infoText}>No highlights provided</p>
        )}
      </div>

      {/* Keywords (відображення як "чіпи") */}
      <div className={s.infoCard}>
        <div
          className={s.copyIcon}
          onClick={() => handleCopy(keywordsToShow.join(", "))}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M10 1H2a1 1 0 0 0-1 1v11h1V2h8V1zm5 2H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm-1 11H6V5h8v9z" />
          </svg>
        </div>
        <h3 className={s.infoTitle}>Keywords</h3>
        {keywordsToShow && keywordsToShow.length > 0 ? (
          <div className={s.keywordsContainer}>
            {keywordsToShow.map((keyword, index) => (
              <span key={index} className={s.keyword}>
                {keyword}
              </span>
            ))}
          </div>
        ) : (
          <p className={s.infoText}>No keywords provided</p>
        )}
      </div>

      {/* Модальне вікно History */}
      {showHistory && (
        <div className={s.modalOverlay}>
          <div className={s.modalContent}>
            <button className={s.closeModalBtn} onClick={handleHistoryClick}>
              ✕
            </button>
            <h3>History</h3>
            {history.length > 0 ? (
              <ul>
                {history.map((entry, index) => (
                  <li key={index}>
                    <strong>{entry.filename}</strong>: {entry.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No history entries available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Pdf;
