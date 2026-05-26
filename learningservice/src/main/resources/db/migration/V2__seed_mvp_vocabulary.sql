INSERT INTO decks (name, description, level, topic, is_active) VALUES
('Daily English A1', 'Common words for daily conversations', 'A1', 'daily', 1),
('Travel English A2', 'Useful vocabulary for trips, airports, and hotels', 'A2', 'travel', 1),
('Business English B1', 'Workplace vocabulary for meetings and email', 'B1', 'business', 1);

INSERT INTO vocabulary_items
  (deck_id, word, phonetic, part_of_speech, definition_en, definition_vi, example_sentence, example_sentence_vi, order_in_deck)
VALUES
  (1, 'water', '/ˈwɔːtər/', 'noun', 'A clear liquid that people drink.', 'Nước uống hoặc nước nói chung.', 'I drink water every morning.', 'Tôi uống nước mỗi buổi sáng.', 1),
  (1, 'breakfast', '/ˈbrekfəst/', 'noun', 'The first meal of the day.', 'Bữa ăn đầu tiên trong ngày.', 'She eats breakfast at seven.', 'Cô ấy ăn sáng lúc bảy giờ.', 2),
  (1, 'friendly', '/ˈfrendli/', 'adjective', 'Kind and pleasant to other people.', 'Thân thiện, tử tế với người khác.', 'Our new teacher is friendly.', 'Giáo viên mới của chúng tôi rất thân thiện.', 3),
  (1, 'listen', '/ˈlɪsən/', 'verb', 'To give attention to sound or speech.', 'Lắng nghe âm thanh hoặc lời nói.', 'Please listen to the question.', 'Vui lòng lắng nghe câu hỏi.', 4),

  (2, 'ticket', '/ˈtɪkɪt/', 'noun', 'A document that lets you travel or enter a place.', 'Vé dùng để đi lại hoặc vào một nơi.', 'I booked a train ticket online.', 'Tôi đã đặt vé tàu trực tuyến.', 1),
  (2, 'luggage', '/ˈlʌɡɪdʒ/', 'noun', 'Bags and suitcases used when traveling.', 'Hành lý khi đi du lịch.', 'My luggage is very heavy.', 'Hành lý của tôi rất nặng.', 2),
  (2, 'departure', '/dɪˈpɑːrtʃər/', 'noun', 'The act or time of leaving a place.', 'Sự khởi hành hoặc thời điểm rời đi.', 'The departure time is 9 a.m.', 'Thời gian khởi hành là 9 giờ sáng.', 3),
  (2, 'reservation', '/ˌrezərˈveɪʃən/', 'noun', 'An arrangement to keep a seat, room, or service.', 'Việc đặt trước chỗ, phòng hoặc dịch vụ.', 'We have a hotel reservation.', 'Chúng tôi có đặt phòng khách sạn.', 4),

  (3, 'meeting', '/ˈmiːtɪŋ/', 'noun', 'An event where people discuss work or plans.', 'Cuộc họp để thảo luận công việc hoặc kế hoạch.', 'The meeting starts at ten.', 'Cuộc họp bắt đầu lúc mười giờ.', 1),
  (3, 'deadline', '/ˈdedlaɪn/', 'noun', 'The latest time to finish something.', 'Hạn cuối để hoàn thành việc gì đó.', 'The deadline is next Friday.', 'Hạn cuối là thứ Sáu tới.', 2),
  (3, 'feedback', '/ˈfiːdbæk/', 'noun', 'Comments that help improve work.', 'Nhận xét giúp cải thiện công việc.', 'Thank you for your feedback.', 'Cảm ơn phản hồi của bạn.', 3),
  (3, 'schedule', '/ˈskedʒuːl/', 'noun', 'A plan of times for activities.', 'Lịch trình hoặc kế hoạch thời gian cho các hoạt động.', 'Please check your schedule.', 'Vui lòng kiểm tra lịch trình của bạn.', 4);
