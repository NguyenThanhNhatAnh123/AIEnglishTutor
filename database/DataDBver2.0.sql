-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- NOTE:
-- This is a database dump for manual/local usage only.
-- It is NOT used by the application runtime.
-- The backend uses Flyway with locations=classpath:db/migration.
--
-- Prefer putting executable migrations under:
--   backend/src/main/resources/db/migration/
--
-- Host: 127.0.0.1    Database: ai_english_exam
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_results`
--

DROP TABLE IF EXISTS `ai_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `answer_id` int DEFAULT NULL,
  `grammar_score` float DEFAULT NULL,
  `vocabulary_score` float DEFAULT NULL,
  `fluency_score` float DEFAULT NULL,
  `pronunciation_score` float DEFAULT NULL,
  `coherence_score` float DEFAULT NULL,
  `overall_score` float DEFAULT NULL,
  `feedback` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_results_answer` (`answer_id`),
  CONSTRAINT `fk_ai_results_answer_cascade` FOREIGN KEY (`answer_id`) REFERENCES `answers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_results`
--

LOCK TABLES `ai_results` WRITE;
/*!40000 ALTER TABLE `ai_results` DISABLE KEYS */;
INSERT INTO `ai_results` VALUES (1,1,4,4,4,4,4,4,'Good','2026-03-12 09:34:41'),(2,2,3.5,4,3.8,4,3.9,3.9,'Good essay','2026-03-12 09:34:41'),(6,8,6.97003,7.44584,NULL,NULL,6.62853,6.91404,'Overall: 6.9/10.','2026-04-04 18:55:47'),(7,31,6.81417,NULL,5.6883,6.53869,NULL,6.21801,'Overall: 6.2/10. Work on fluency and pacing.','2026-04-22 03:09:01'),(8,32,9.18775,NULL,9.08991,8.48685,NULL,8.71597,'Overall: 8.7/10. Well done!','2026-04-22 03:14:00'),(9,33,5.84212,NULL,6.07567,5.61518,NULL,6.18191,'Overall: 6.2/10. Practice pronunciation. Focus on grammatical accuracy.','2026-04-24 18:54:28');
/*!40000 ALTER TABLE `ai_results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_scoring_logs`
--

DROP TABLE IF EXISTS `ai_scoring_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_scoring_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `answer_id` int NOT NULL,
  `submission_id` int NOT NULL,
  `scoring_type` varchar(20) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `model` varchar(100) DEFAULT NULL,
  `endpoint` varchar(255) DEFAULT NULL,
  `request_payload` longtext,
  `response_body` longtext,
  `http_status` int DEFAULT NULL,
  `success_flag` bit(1) NOT NULL,
  `latency_ms` bigint DEFAULT NULL,
  `error_message` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_scoring_logs_answer` (`answer_id`),
  KEY `idx_ai_scoring_logs_submission` (`submission_id`),
  KEY `idx_ai_scoring_logs_type` (`scoring_type`),
  CONSTRAINT `fk_ai_scoring_logs_answer` FOREIGN KEY (`answer_id`) REFERENCES `answers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_scoring_logs_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_scoring_logs`
--

LOCK TABLES `ai_scoring_logs` WRITE;
/*!40000 ALTER TABLE `ai_scoring_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_scoring_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `answers`
--

DROP TABLE IF EXISTS `answers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int DEFAULT NULL,
  `question_id` int DEFAULT NULL,
  `answer_type` enum('TEXT','CHOICE','AUDIO') DEFAULT NULL,
  `content` text,
  `answer_text` text,
  `selected_option_id` int DEFAULT NULL,
  `audio_url` varchar(500) DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `speaking_audio_url` varchar(255) DEFAULT NULL,
  `speaking_duration_seconds` int DEFAULT NULL,
  `speaking_format` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_answers_submission_cascade` (`submission_id`),
  KEY `fk_answers_question_cascade` (`question_id`),
  CONSTRAINT `fk_answers_question_cascade` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_answers_submission_cascade` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `answers`
--

LOCK TABLES `answers` WRITE;
/*!40000 ALTER TABLE `answers` DISABLE KEYS */;
INSERT INTO `answers` VALUES (1,1,1,'TEXT','Answer A','Answer A',NULL,NULL,NULL,'2026-03-12 09:34:34',NULL,NULL,NULL),(2,2,2,'TEXT','Essay answer','Essay answer',NULL,NULL,NULL,'2026-03-12 09:34:34',NULL,NULL,NULL),(3,3,3,'TEXT','Speaking answer','Speaking answer',NULL,NULL,NULL,'2026-03-12 09:34:34',NULL,NULL,NULL),(4,4,4,'TEXT','Short answer','Short answer',NULL,NULL,NULL,'2026-03-12 09:34:34',NULL,NULL,NULL),(6,6,1,NULL,NULL,NULL,1,NULL,NULL,'2026-04-04 18:55:35',NULL,NULL,NULL),(7,6,6,NULL,NULL,NULL,7,NULL,NULL,'2026-04-04 18:55:36',NULL,NULL,NULL),(8,6,2,NULL,NULL,'q',NULL,NULL,NULL,'2026-04-04 18:55:38',NULL,NULL,NULL),(9,7,3,NULL,NULL,NULL,NULL,'blob:http://localhost:5173/4f52cfba-5470-4cab-b4e6-0d0285ecafea',NULL,'2026-04-04 18:56:08','blob:http://localhost:5173/4f52cfba-5470-4cab-b4e6-0d0285ecafea',NULL,'mp3'),(12,1,7,'AUDIO','Listening answer',NULL,NULL,'/audio/Ltest.mp3',NULL,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,'mp3'),(13,1,8,'AUDIO','Listening answer',NULL,NULL,'/audio/Ltest.mp3',NULL,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,'mp3'),(14,1,9,'AUDIO','Listening answer',NULL,NULL,'/audio/Ltest.mp3',NULL,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,'mp3'),(15,1,10,'AUDIO','Listening answer',NULL,NULL,'/audio/Ltest.mp3',NULL,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,'mp3'),(16,1,11,'AUDIO','Listening answer',NULL,NULL,'/audio/Ltest.mp3',NULL,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,'mp3'),(19,14,1,NULL,NULL,NULL,1,NULL,NULL,'2026-04-12 21:11:48',NULL,NULL,NULL),(20,15,7,NULL,NULL,NULL,10,NULL,NULL,'2026-04-12 21:25:43',NULL,NULL,NULL),(21,15,8,NULL,NULL,NULL,14,NULL,NULL,'2026-04-12 21:25:45',NULL,NULL,NULL),(22,15,9,NULL,NULL,NULL,18,NULL,NULL,'2026-04-12 21:25:46',NULL,NULL,NULL),(23,15,10,NULL,NULL,NULL,22,NULL,NULL,'2026-04-12 21:25:47',NULL,NULL,NULL),(24,15,11,NULL,NULL,NULL,26,NULL,NULL,'2026-04-12 21:25:48',NULL,NULL,NULL),(25,16,7,NULL,NULL,NULL,8,NULL,NULL,'2026-04-12 21:51:58',NULL,NULL,NULL),(26,18,13,NULL,NULL,NULL,33,NULL,NULL,'2026-04-21 19:26:48',NULL,NULL,NULL),(27,19,7,NULL,NULL,NULL,10,NULL,NULL,'2026-04-22 02:49:10',NULL,NULL,NULL),(28,19,8,NULL,NULL,NULL,13,NULL,NULL,'2026-04-22 02:49:12',NULL,NULL,NULL),(29,19,9,NULL,NULL,NULL,16,NULL,NULL,'2026-04-22 02:49:16',NULL,NULL,NULL),(30,19,11,NULL,NULL,NULL,24,NULL,NULL,'2026-04-22 02:49:22',NULL,NULL,NULL),(31,22,3,NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-22 03:08:53','/uploads/audio/speaking/9971c73c6e0d4642942629d291a4962a_1_3.mp3',4,'mp3'),(32,23,3,NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-22 03:11:09','/uploads/audio/speaking/48223ac9559e495dbfef6d96409575b5_1_3.mp3',1,'mp3'),(33,24,3,NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-24 18:54:25','/uploads/audio/speaking/a46a0a87a9044fa68c262db780e9c847_1_3.mp3',2,'mp3');
/*!40000 ALTER TABLE `answers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `class_students`
--

DROP TABLE IF EXISTS `class_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `class_students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_class_student` (`class_id`,`student_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `class_students_ibfk_1` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `class_students_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `class_students`
--

LOCK TABLES `class_students` WRITE;
/*!40000 ALTER TABLE `class_students` DISABLE KEYS */;
INSERT INTO `class_students` VALUES (1,1,1,'2026-03-12 09:33:49'),(2,1,2,'2026-03-12 09:33:49'),(6,1,3,'2026-03-12 02:33:49'),(7,1,4,'2026-03-12 02:33:49'),(8,1,5,'2026-03-12 02:33:49'),(9,5,2,'2026-04-17 16:05:13');
/*!40000 ALTER TABLE `class_students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classes`
--

DROP TABLE IF EXISTS `classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `teacher_id` int DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teacher_id` (`teacher_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classes`
--

LOCK TABLES `classes` WRITE;
/*!40000 ALTER TABLE `classes` DISABLE KEYS */;
INSERT INTO `classes` VALUES (1,'English 10A',1,'Basic English','2026-03-12 09:33:42'),(2,'English 10B',2,'English class','2026-03-12 09:33:42'),(3,'English 11A',1,'Intermediate','2026-03-12 09:33:42'),(4,'English 11B',2,'Intermediate','2026-03-12 09:33:42'),(5,'English 12A',1,'Advanced','2026-03-12 09:33:42');
/*!40000 ALTER TABLE `classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_attempts`
--

DROP TABLE IF EXISTS `exam_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `exam_id` int DEFAULT NULL,
  `attempt_number` int DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKt2bysgtvvg64lgryf27b1xo76` (`student_id`),
  KEY `fk_exam_attempts_exam_cascade` (`exam_id`),
  CONSTRAINT `fk_exam_attempts_exam_cascade` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FKt2bysgtvvg64lgryf27b1xo76` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_attempts`
--

LOCK TABLES `exam_attempts` WRITE;
/*!40000 ALTER TABLE `exam_attempts` DISABLE KEYS */;
INSERT INTO `exam_attempts` VALUES (1,1,1,1,'2026-03-12 16:35:11','2026-03-12 16:35:11'),(2,2,1,1,'2026-03-12 16:35:11','2026-03-12 16:35:11'),(3,1,2,1,'2026-03-12 16:35:11','2026-03-12 16:35:11'),(4,2,3,1,'2026-03-12 16:35:11','2026-03-12 16:35:11'),(5,1,4,1,'2026-03-12 16:35:11','2026-03-12 16:35:11'),(6,1,1,2,'2026-03-12 16:34:27','2026-03-12 16:34:27'),(7,2,1,2,'2026-03-12 16:34:27','2026-03-12 16:34:27'),(8,1,2,2,'2026-03-12 16:34:27','2026-03-12 16:34:27'),(9,2,3,2,'2026-03-12 16:34:27','2026-03-12 16:34:27'),(10,1,4,2,'2026-03-12 16:34:27','2026-03-12 16:34:27'),(11,1,1,3,'2026-04-05 01:55:31','2026-04-05 01:55:47'),(12,1,2,3,'2026-04-05 01:55:58','2026-04-13 04:11:40'),(13,1,1,4,'2026-04-13 02:26:52','2026-04-13 02:27:04'),(14,1,5,1,'2026-04-13 02:27:58','2026-04-13 02:28:14'),(15,1,3,1,'2026-04-13 03:21:27','2026-04-13 03:21:36'),(16,1,3,2,'2026-04-13 03:21:42','2026-04-13 03:21:47'),(17,1,5,2,'2026-04-13 04:10:53','2026-04-13 04:10:58'),(18,1,3,3,'2026-04-13 04:11:04','2026-04-13 04:11:21'),(19,1,1,5,'2026-04-13 04:11:46','2026-04-22 09:50:32'),(20,1,3,4,'2026-04-13 04:16:49','2026-04-13 04:25:50'),(21,1,3,5,'2026-04-13 04:51:49','2026-04-13 04:52:01'),(22,1,2,4,'2026-04-14 04:36:01','2026-04-22 09:50:14'),(23,1,11,1,'2026-04-22 02:26:46','2026-04-22 02:26:57'),(24,1,3,6,'2026-04-22 09:48:59','2026-04-22 09:49:29'),(25,1,5,3,'2026-04-22 09:50:19',NULL),(26,1,4,3,'2026-04-22 09:50:29',NULL),(27,1,2,5,'2026-04-22 09:51:04','2026-04-22 10:09:01'),(28,1,2,6,'2026-04-22 10:11:03','2026-04-22 10:14:00'),(29,1,2,7,'2026-04-25 01:54:12','2026-04-25 01:54:28');
/*!40000 ALTER TABLE `exam_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_sections`
--

DROP TABLE IF EXISTS `exam_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `order_index` int DEFAULT NULL,
  `section_type` enum('LISTENING','READING','SPEAKING','WRITING') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sections_exam` (`exam_id`),
  CONSTRAINT `fk_exam_sections_exam_cascade` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_sections`
--

LOCK TABLES `exam_sections` WRITE;
/*!40000 ALTER TABLE `exam_sections` DISABLE KEYS */;
INSERT INTO `exam_sections` VALUES (1,1,'READING',1,'READING'),(2,1,'WRITING',2,'WRITING'),(3,2,'SPEAKING',1,'SPEAKING'),(4,3,'LISTENING',1,'LISTENING'),(13,11,'Reading',1,'READING'),(14,5,'READING',1,'READING'),(15,12,'test',0,'LISTENING');
/*!40000 ALTER TABLE `exam_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exams`
--

DROP TABLE IF EXISTS `exams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT NULL,
  `description` text,
  `teacher_id` int DEFAULT NULL,
  `duration_minutes` int DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `teacher_id` (`teacher_id`),
  CONSTRAINT `exams_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exams`
--

LOCK TABLES `exams` WRITE;
/*!40000 ALTER TABLE `exams` DISABLE KEYS */;
INSERT INTO `exams` VALUES (1,'English Test 1','Midterm test',1,60,'ACTIVE','2026-03-12 09:33:55'),(2,'English Test 2','Final test',1,90,'ACTIVE','2026-03-12 09:33:55'),(3,'Speaking Test','Speaking exam',2,30,'ACTIVE','2026-03-12 09:33:55'),(4,'Writing Test','Essay writing',1,45,'ACTIVE','2026-03-12 09:33:55'),(5,'Listening Test','Listening exam',2,40,'ACTIVE','2026-03-12 09:33:55'),(11,'Hehe','TEST',1,60,'CLOSED','2026-04-17 16:09:03'),(12,'Listen','He',1,60,'ACTIVE','2026-04-24 18:56:07');
/*!40000 ALTER TABLE `exams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedbacks`
--

DROP TABLE IF EXISTS `feedbacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedbacks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `answer_id` int DEFAULT NULL,
  `teacher_feedback` text,
  `ai_feedback` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_feedbacks_answer` (`answer_id`),
  CONSTRAINT `fk_feedbacks_answer_cascade` FOREIGN KEY (`answer_id`) REFERENCES `answers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedbacks`
--

LOCK TABLES `feedbacks` WRITE;
/*!40000 ALTER TABLE `feedbacks` DISABLE KEYS */;
INSERT INTO `feedbacks` VALUES (1,1,'Good answer','AI good','2026-03-12 09:35:05'),(2,2,'Improve vocabulary','AI average','2026-03-12 09:35:05'),(3,3,'Good speaking','AI good','2026-03-12 09:35:05'),(4,4,'Need improvement','AI low','2026-03-12 09:35:05');
/*!40000 ALTER TABLE `feedbacks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `media_files`
--

DROP TABLE IF EXISTS `media_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `media_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_url` varchar(500) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `question_id` int DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_media_question` (`question_id`),
  CONSTRAINT `fk_media_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `media_files`
--

LOCK TABLES `media_files` WRITE;
/*!40000 ALTER TABLE `media_files` DISABLE KEYS */;
INSERT INTO `media_files` VALUES (1,'audio1.mp3','audio',3,'2026-03-12 09:34:58',NULL,NULL),(2,'audio2.mp3','audio',3,'2026-03-12 09:34:58',NULL,NULL),(3,'image1.png','image',3,'2026-03-12 09:34:58',NULL,NULL),(4,'image2.png','image',4,'2026-03-12 09:34:58',NULL,NULL),(5,'doc1.pdf','document',2,'2026-03-12 09:34:58',NULL,NULL),(6,'/audio/Ltest.mp3','audio',1,'2026-04-13 03:39:13',NULL,NULL),(7,'/api/media/files/749db40b-9f01-4bc3-b3d0-6b25d34df16f.mp3','audio/mpeg',2,'2026-04-24 18:51:50',NULL,NULL),(8,'/api/media/files/5a370359-fefa-4ed9-9cd4-05748546e1c0.mp3','audio/mpeg',2,'2026-04-24 18:56:44',NULL,NULL),(9,'/api/media/files/aede9abe-fadc-4f58-8a16-bc6102e5923f.mp3','audio/mpeg',2,'2026-04-24 18:57:12',NULL,NULL),(10,'/api/media/files/fb651bbb-0d81-4346-9f83-27bbd4cc4f9a.mp3','audio/mpeg',2,'2026-04-24 19:31:50',NULL,NULL);
/*!40000 ALTER TABLE `media_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question_options`
--

DROP TABLE IF EXISTS `question_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int DEFAULT NULL,
  `option_text` varchar(500) DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_question_options_question_cascade` (`question_id`),
  CONSTRAINT `fk_question_options_question_cascade` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_options`
--

LOCK TABLES `question_options` WRITE;
/*!40000 ALTER TABLE `question_options` DISABLE KEYS */;
INSERT INTO `question_options` VALUES (1,1,'Option A',1),(2,1,'Option B',0),(3,1,'Option C',0),(6,6,'a',0),(7,6,'a',0),(8,7,'A. 5:30 AM',0),(9,7,'B. 6:00 AM',1),(10,7,'C. 6:30 AM',0),(11,7,'D. 7:00 AM',0),(12,8,'A. Watches TV',0),(13,8,'B. Goes jogging',0),(14,8,'C. Does exercise',1),(15,8,'D. Cooks breakfast',0),(16,9,'A. 4:00 PM',0),(17,9,'B. 5:00 PM',1),(18,9,'C. 6:00 PM',0),(19,9,'D. 7:00 PM',0),(20,10,'A. Goes to the gym',0),(21,10,'B. Watches movies',0),(22,10,'C. Reads books',1),(23,10,'D. Plays games',0),(24,11,'A. Works overtime',0),(25,11,'B. Stays at home',0),(26,11,'C. Meets friends or travels',1),(27,11,'D. Goes to school',0),(28,12,'Anh',1),(29,12,'Tom',0),(30,12,'Đẹp',0),(31,12,'Trai',0),(32,13,'Anh',0),(33,13,'Tom',1),(34,13,'Đẹp',0),(35,13,'Trai',0),(36,14,'12',0),(37,14,'12',0),(38,14,'122',0),(39,14,'122',1),(40,15,'a',0),(41,15,'aaa',1),(44,17,'ffff',1),(45,17,'ffff',0),(46,18,'t',0),(47,18,'g',1);
/*!40000 ALTER TABLE `question_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question_tag_map`
--

DROP TABLE IF EXISTS `question_tag_map`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_tag_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int DEFAULT NULL,
  `tag_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `question_id` (`question_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `question_tag_map_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`),
  CONSTRAINT `question_tag_map_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `question_tags` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_tag_map`
--

LOCK TABLES `question_tag_map` WRITE;
/*!40000 ALTER TABLE `question_tag_map` DISABLE KEYS */;
INSERT INTO `question_tag_map` VALUES (1,1,1),(2,2,4),(3,3,5),(4,4,3);
/*!40000 ALTER TABLE `question_tag_map` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question_tags`
--

DROP TABLE IF EXISTS `question_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question_tags`
--

LOCK TABLES `question_tags` WRITE;
/*!40000 ALTER TABLE `question_tags` DISABLE KEYS */;
INSERT INTO `question_tags` VALUES (1,'Grammar'),(2,'Vocabulary'),(3,'Reading'),(4,'Writing'),(5,'Speaking');
/*!40000 ALTER TABLE `question_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_id` int DEFAULT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(50) DEFAULT NULL,
  `points` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `audio_url` varchar(500) DEFAULT NULL,
  `passage_id` int DEFAULT NULL,
  `min_words` int DEFAULT NULL,
  `max_words` int DEFAULT NULL,
  `listening_audio_url` varchar(500) DEFAULT NULL,
  `transcript` text,
  PRIMARY KEY (`id`),
  KEY `fk_passage` (`passage_id`),
  KEY `idx_questions_section` (`section_id`),
  CONSTRAINT `fk_passage` FOREIGN KEY (`passage_id`) REFERENCES `reading_passages` (`id`),
  CONSTRAINT `fk_questions_section_cascade` FOREIGN KEY (`section_id`) REFERENCES `exam_sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,1,'Choose correct answer','MULTIPLE_CHOICE',2,'2026-03-12 09:34:09',NULL,NULL,NULL,NULL,NULL,NULL),(2,2,'Write an essay about environment','WRITING',10,'2026-03-12 09:34:09',NULL,NULL,150,250,NULL,NULL),(3,3,'Describe your hometown','SPEAKING',8,'2026-03-12 09:34:09',NULL,NULL,NULL,NULL,'/api/media/files/749db40b-9f01-4bc3-b3d0-6b25d34df16f.mp3',NULL),(4,4,'Listen and answer question','LISTENING',3,'2026-03-12 09:34:09','audio1.mp3',NULL,NULL,NULL,'audio1.mp3',NULL),(6,1,'aaa','MULTIPLE_CHOICE',1,'2026-04-04 18:35:56',NULL,NULL,NULL,NULL,NULL,NULL),(7,4,'What time does the speaker wake up?','LISTENING',2,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,NULL,NULL,'/audio/Ltest.mp3',NULL),(8,4,'What does he do after waking up?','LISTENING',2,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,NULL,NULL,'/audio/Ltest.mp3',NULL),(9,4,'When does he finish work?','LISTENING',2,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,NULL,NULL,'/audio/Ltest.mp3',NULL),(10,4,'What does he do in the evening?','LISTENING',2,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,NULL,NULL,'/audio/Ltest.mp3',NULL),(11,4,'What does he do on weekends?','LISTENING',2,'2026-04-13 03:39:13','/audio/Ltest.mp3',NULL,NULL,NULL,'/audio/Ltest.mp3',NULL),(12,1,'what is you name ?','MULTIPLE_CHOICE',1,'2026-04-17 16:08:22',NULL,NULL,NULL,NULL,NULL,NULL),(13,13,'WHAT IS YOUR NAME ?','MULTIPLE_CHOICE',1,'2026-04-21 19:25:39',NULL,NULL,NULL,NULL,NULL,NULL),(14,13,'How old are you ?','MULTIPLE_CHOICE',10,'2026-04-22 02:46:45',NULL,NULL,NULL,NULL,NULL,NULL),(15,13,'hi','MULTIPLE_CHOICE',1,'2026-04-24 19:48:51',NULL,NULL,NULL,NULL,NULL,NULL),(17,13,'ff','MULTIPLE_CHOICE',1,'2026-04-24 19:52:58',NULL,NULL,NULL,NULL,NULL,NULL),(18,13,'hiiiii','MULTIPLE_CHOICE',1,'2026-04-24 19:52:58',NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reading_passages`
--

DROP TABLE IF EXISTS `reading_passages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reading_passages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text,
  PRIMARY KEY (`id`),
  KEY `section_id` (`section_id`),
  CONSTRAINT `reading_passages_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `exam_sections` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reading_passages`
--

LOCK TABLES `reading_passages` WRITE;
/*!40000 ALTER TABLE `reading_passages` DISABLE KEYS */;
/*!40000 ALTER TABLE `reading_passages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'ADMIN','System admin'),(2,'TEACHER','Teacher role'),(3,'STUDENT','Student role'),(4,'ASSISTANT','Assistant role'),(5,'GUEST','Guest role');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `scores`
--

DROP TABLE IF EXISTS `scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int DEFAULT NULL,
  `mc_score` float DEFAULT NULL,
  `writing_score` float DEFAULT NULL,
  `speaking_score` float DEFAULT NULL,
  `total_score` float DEFAULT NULL,
  `graded_by` int DEFAULT NULL,
  `graded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `listening_score` float DEFAULT '0',
  `reading_score` float DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scores_submission` (`submission_id`),
  CONSTRAINT `fk_scores_submission_cascade` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `scores`
--

LOCK TABLES `scores` WRITE;
/*!40000 ALTER TABLE `scores` DISABLE KEYS */;
INSERT INTO `scores` VALUES (1,1,8,0,0,8,2,'2026-03-12 09:34:47',4,4),(2,2,7,0,0,7,2,'2026-03-12 09:34:47',3.5,3.5),(3,3,0,0,8,8,2,'2026-03-12 09:34:47',0,0),(4,4,0,7,0,7,2,'2026-03-12 09:34:47',0,0),(5,5,9,0,0,9,2,'2026-03-12 09:34:47',4.5,4.5),(6,6,66.6667,69.1404,NULL,67.9035,NULL,'2026-04-04 18:55:47',0,0),(8,9,NULL,NULL,NULL,0,NULL,'2026-04-12 19:28:14',0,0),(9,10,0,NULL,NULL,0,NULL,'2026-04-12 20:21:36',0,0),(10,11,0,NULL,NULL,0,NULL,'2026-04-12 20:21:47',0,0),(11,12,NULL,NULL,NULL,0,NULL,'2026-04-12 21:10:58',0,0),(12,13,0,NULL,NULL,0,NULL,'2026-04-12 21:11:21',0,0),(13,7,NULL,NULL,0,0,NULL,'2026-04-12 21:11:40',0,0),(14,15,46.1538,NULL,NULL,46.1538,NULL,'2026-04-12 21:25:50',0,0),(15,16,0,NULL,NULL,0,NULL,'2026-04-12 21:52:01',0,0),(16,18,100,NULL,NULL,100,NULL,'2026-04-21 19:26:57',0,0),(17,19,0,NULL,NULL,0,NULL,'2026-04-22 02:49:29',0,0),(18,17,NULL,NULL,0,0,NULL,'2026-04-22 02:50:14',0,0),(19,14,50,0,NULL,25,NULL,'2026-04-22 02:50:32',0,0),(20,22,NULL,NULL,62.1801,62.1801,NULL,'2026-04-22 03:09:01',0,0),(21,23,NULL,NULL,87.1597,87.1597,NULL,'2026-04-22 03:14:00',0,0),(22,24,NULL,NULL,61.8191,61.8191,NULL,'2026-04-24 18:54:28',0,0);
/*!40000 ALTER TABLE `scores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_progress`
--

DROP TABLE IF EXISTS `student_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int DEFAULT NULL,
  `exam_id` int DEFAULT NULL,
  `average_score` float DEFAULT NULL,
  `attempt_count` int DEFAULT NULL,
  `last_attempt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_progress`
--

LOCK TABLES `student_progress` WRITE;
/*!40000 ALTER TABLE `student_progress` DISABLE KEYS */;
INSERT INTO `student_progress` VALUES (1,1,1,8,1,'2026-03-12 16:35:27'),(2,2,1,7,1,'2026-03-12 16:35:27'),(3,3,2,8,1,'2026-03-12 16:35:27'),(4,4,3,7,1,'2026-03-12 16:35:27'),(5,5,4,9,1,'2026-03-12 16:35:27');
/*!40000 ALTER TABLE `student_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `student_code` varchar(50) NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,3,'SV001','2002-01-01','2026-03-12 09:33:28'),(2,4,'SV002','2002-05-10','2026-03-12 09:33:28'),(3,6,'SV003','2002-03-15','2026-03-12 02:33:28'),(4,7,'SV004','2002-07-20','2026-03-12 02:33:28'),(5,8,'SV005','2002-09-25','2026-03-12 02:33:28');
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submission_suspicious_events`
--

DROP TABLE IF EXISTS `submission_suspicious_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submission_suspicious_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `student_id` int NOT NULL,
  `event_type` varchar(20) NOT NULL,
  `event_count` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_submission_suspicious_event` (`submission_id`,`event_type`),
  KEY `idx_submission_suspicious_events_submission` (`submission_id`),
  KEY `idx_submission_suspicious_events_student` (`student_id`),
  CONSTRAINT `fk_submission_suspicious_events_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `fk_submission_suspicious_events_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submission_suspicious_events`
--

LOCK TABLES `submission_suspicious_events` WRITE;
/*!40000 ALTER TABLE `submission_suspicious_events` DISABLE KEYS */;
INSERT INTO `submission_suspicious_events` VALUES (1,23,1,'TAB_SWITCH',4,'2026-04-22 03:14:00'),(2,23,1,'FOCUS_LOSS',3,'2026-04-22 03:14:00');
/*!40000 ALTER TABLE `submission_suspicious_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `submissions`
--

DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `start_time` datetime DEFAULT NULL,
  `submit_time` datetime DEFAULT NULL,
  `status` varchar(20) DEFAULT 'IN_PROGRESS',
  `attempt_id` int DEFAULT NULL,
  `client_reported_duration` int DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `end_time` datetime(6) DEFAULT NULL,
  `answered_questions` int DEFAULT NULL,
  `completion_percent` int DEFAULT NULL,
  `copy_paste_count` int DEFAULT NULL,
  `device_label` varchar(255) DEFAULT NULL,
  `device_type` varchar(20) DEFAULT NULL,
  `focus_loss_count` int DEFAULT NULL,
  `suspicious_event_count` int DEFAULT NULL,
  `tab_switch_count` int DEFAULT NULL,
  `total_questions` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `idx_submissions_exam_student` (`exam_id`,`student_id`),
  KEY `fk_submissions_attempt_cascade` (`attempt_id`),
  CONSTRAINT `fk_submissions_attempt_cascade` FOREIGN KEY (`attempt_id`) REFERENCES `exam_attempts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_submissions_exam_cascade` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `submissions`
--

LOCK TABLES `submissions` WRITE;
/*!40000 ALTER TABLE `submissions` DISABLE KEYS */;
INSERT INTO `submissions` VALUES (1,1,1,'2026-03-12 16:34:27','2026-03-12 16:34:27','SUBMITTED',6,NULL,0,'2026-03-12 16:34:27.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,1,2,'2026-03-12 16:34:27','2026-03-12 16:34:27','SUBMITTED',7,NULL,0,'2026-03-12 16:34:27.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,2,3,'2026-03-12 16:34:27','2026-03-12 16:34:27','SUBMITTED',8,NULL,0,'2026-03-12 16:34:27.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,3,4,'2026-03-12 16:34:27','2026-03-12 16:34:27','SUBMITTED',9,NULL,0,'2026-03-12 16:34:27.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,4,5,'2026-03-12 16:34:27','2026-03-12 16:34:27','SUBMITTED',10,NULL,0,'2026-03-12 16:34:27.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,1,1,'2026-04-05 01:55:31','2026-04-05 01:55:47','SUBMITTED',11,NULL,16,'2026-04-05 01:55:47.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,2,1,'2026-04-05 01:55:58','2026-04-13 04:11:40','AUTO_SUBMITTED',12,699341,699341,'2026-04-13 04:11:39.770222',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,5,1,'2026-04-13 02:27:58','2026-04-13 02:28:14','SUBMITTED',14,NULL,16,'2026-04-13 02:28:14.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,3,1,'2026-04-13 03:21:27','2026-04-13 03:21:36','SUBMITTED',15,NULL,9,'2026-04-13 03:21:36.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,3,1,'2026-04-13 03:21:42','2026-04-13 03:21:47','SUBMITTED',16,NULL,5,'2026-04-13 03:21:47.000000',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,5,1,'2026-04-13 04:10:53','2026-04-13 04:10:58','SUBMITTED',17,5,5,'2026-04-13 04:10:58.383290',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,3,1,'2026-04-13 04:11:04','2026-04-13 04:11:21','SUBMITTED',18,17,17,'2026-04-13 04:11:21.224917',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(14,1,1,'2026-04-13 04:11:46','2026-04-22 09:50:32','AUTO_SUBMITTED',19,797926,797926,'2026-04-22 09:50:32.422406',1,25,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,4),(15,3,1,'2026-04-13 04:16:49','2026-04-13 04:25:50','SUBMITTED',20,541,541,'2026-04-13 04:25:50.178291',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,3,1,'2026-04-13 04:51:49','2026-04-13 04:52:01','SUBMITTED',21,12,12,'2026-04-13 04:52:01.483611',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(17,2,1,'2026-04-14 04:36:01','2026-04-22 09:50:14','AUTO_SUBMITTED',22,710053,710053,'2026-04-22 09:50:14.053902',0,0,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,1),(18,11,1,'2026-04-22 02:26:46','2026-04-22 02:26:57','SUBMITTED',23,11,10,'2026-04-22 02:26:56.921431',1,100,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,1),(19,3,1,'2026-04-22 09:48:59','2026-04-22 09:49:29','SUBMITTED',24,30,30,'2026-04-22 09:49:29.100552',4,67,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,6),(20,5,1,'2026-04-22 09:50:19',NULL,'IN_PROGRESS',25,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(21,4,1,'2026-04-22 09:50:29',NULL,'IN_PROGRESS',26,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(22,2,1,'2026-04-22 09:51:04','2026-04-22 10:09:01','SUBMITTED',27,1076,1076,'2026-04-22 10:09:00.670918',1,100,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,1),(23,2,1,'2026-04-22 10:11:03','2026-04-22 10:14:00','SUBMITTED',28,177,177,'2026-04-22 10:14:00.244650',1,100,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',3,7,4,1),(24,2,1,'2026-04-25 01:54:12','2026-04-25 01:54:28','SUBMITTED',29,16,16,'2026-04-25 01:54:28.069623',1,100,0,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0','DESKTOP',0,0,0,1);
/*!40000 ALTER TABLE `submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) DEFAULT NULL,
  `setting_value` varchar(500) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES (1,'max_exam_time','120','Maximum exam time'),(2,'ai_model','gpt','AI model'),(3,'file_upload_limit','20MB','Upload limit'),(4,'language','en','System language'),(5,'theme','dark','UI theme');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teachers`
--

DROP TABLE IF EXISTS `teachers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teachers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `teacher_code` varchar(50) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `teachers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teachers`
--

LOCK TABLES `teachers` WRITE;
/*!40000 ALTER TABLE `teachers` DISABLE KEYS */;
INSERT INTO `teachers` VALUES (1,2,'GV001','English','2026-03-12 09:33:35'),(2,5,'GV002','English','2026-03-12 09:33:35');
/*!40000 ALTER TABLE `teachers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','admin@mail.com','$2a$10$UKEmVR/dU9tp3r6KR3vMae8H.D2Y1n61H4QDwIuk/bemiWdcpBroW','Admin User',1,'ACTIVE','2026-03-12 09:33:20'),(2,'teacher1','teacher1@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Nguyen Van A',2,'ACTIVE','2026-03-12 09:33:20'),(3,'student1','student1@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Tran Van B',3,'ACTIVE','2026-03-12 09:33:20'),(4,'student2','student2@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Le Thi C',3,'ACTIVE','2026-03-12 09:33:20'),(5,'teacher2','teacher2@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Pham Van D',2,'ACTIVE','2026-03-12 09:33:20'),(6,'student3','student3@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Nguyen Van E',3,'ACTIVE','2026-03-12 02:33:20'),(7,'student4','student4@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Tran Thi F',3,'ACTIVE','2026-03-12 02:33:20'),(8,'student5','student5@mail.com','$2a$10$Gv1i2LabI7sIvftdA5sHWOAvNf0rsNCUCjEMGqey..RBefuhrJNPe','Le Van G',3,'ACTIVE','2026-03-12 02:33:20');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-27 19:59:28
