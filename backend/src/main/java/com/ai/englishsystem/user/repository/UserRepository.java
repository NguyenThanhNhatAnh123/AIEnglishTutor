package com.ai.englishsystem.user.repository;

import com.ai.englishsystem.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);

    @EntityGraph(attributePaths = {"role"})
    @Query("SELECT u FROM User u")
    Page<User> findAllWithRole(Pageable pageable);

    boolean existsByEmail(String email);
    boolean existsByUsername(String username);

    boolean existsByEmailAndIdNot(String email, Integer id);
}
