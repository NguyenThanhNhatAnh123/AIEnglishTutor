FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace
COPY mvnw pom.xml ./
COPY .mvn .mvn
COPY src src
RUN sed -i 's/\r$//' ./mvnw && chmod +x ./mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/target/learningservice-1.0.0.jar /app/app.jar

RUN useradd --create-home --uid 10002 spring \
    && chown -R spring:spring /app
USER spring

EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8081/actuator/health || exit 1
ENTRYPOINT ["java","-XX:+UseG1GC","-XX:MaxRAMPercentage=75.0","-jar","/app/app.jar"]
