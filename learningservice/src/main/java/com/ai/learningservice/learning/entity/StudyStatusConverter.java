package com.ai.learningservice.learning.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class StudyStatusConverter implements AttributeConverter<StudyStatus, String> {
    @Override
    public String convertToDatabaseColumn(StudyStatus attribute) {
        return attribute == null ? null : attribute.value();
    }

    @Override
    public StudyStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : StudyStatus.fromValue(dbData);
    }
}
