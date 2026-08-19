plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.padel.cameraagent"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.padel.cameraagent"
        minSdk = 26          // Android 8.0+ — покрывает все OnePlus
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-sprintA"

        // По умолчанию — локальный gateway (меняется в настройках приложения)
        buildConfigField("String", "DEFAULT_GATEWAY", "\"192.168.1.100\"")
        buildConfigField("int", "DEFAULT_SRT_PORT", "8890")
        buildConfigField("String", "DEFAULT_PLATFORM", "\"http://192.168.1.100:3000\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false // MVP: не обфусцируем — отлаживаем на реальном железе
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // RootEncoder (Apache-2.0, план §237): SRT/RTSP/RTMP стриминг с Camera2
    implementation("com.github.pedroSG94.RootEncoder:library:2.5.7")

    // OkHttp (Apache-2.0): HTTP heartbeat
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // JSON для heartbeat payload
    implementation("org.json:json:20240303")

    // Lifecycle (foreground service)
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // UI — стандартные Android views (MVP; Jetpack Compose позже)
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("com.google.android.material:material:1.12.0")
}
