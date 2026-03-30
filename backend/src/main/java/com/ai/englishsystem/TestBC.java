package com.ai.englishsystem;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestBC {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        System.out.println(encoder.encode("123"));
    }
}