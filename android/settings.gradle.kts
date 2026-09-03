pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") } // RootEncoder (если композитная сборка не подменит)
    }
}

// Локальный правленый RootEncoder (image-quality 2026-09-03: COLOR_RANGE_FULL
// под фактический full-range контент GL-цепочки + forceBt709Color):
// композитная сборка подменяет Maven-артефакт на C:/android-build/RootEncoder-2.7.5.
includeBuild("C:/android-build/RootEncoder-2.7.5") {
    dependencySubstitution {
        substitute(module("com.github.pedroSG94.RootEncoder:library")).using(project(":library"))
    }
}

rootProject.name = "PadelCameraAgent"
include(":app")
