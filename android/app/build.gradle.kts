import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.padel.cameraagent"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.padel.cameraagent"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.0-resilient-camera"
        buildConfigField("String", "DEFAULT_COURT", "\"7dkrYGs\"")
        buildConfigField("String", "DEFAULT_GATEWAY", "\"192.168.31.142\"")
        buildConfigField("int", "DEFAULT_SRT_PORT", "8890")
        buildConfigField("String", "DEFAULT_PLATFORM", "\"http://192.168.31.142:3000\"")
    }
    buildFeatures { buildConfig = true }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("com.github.pedroSG94.RootEncoder:library:2.7.5")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("com.google.android.material:material:1.12.0")
}
