package com.ai.englishsystem.exam.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "question_tags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;
}
