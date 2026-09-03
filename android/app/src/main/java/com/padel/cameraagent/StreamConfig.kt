package com.padel.cameraagent

class StreamConfig private constructor(
    val courtCode: String,
    val gatewayHost: String,
    val platformUrl: String,
    val width: Int,
    val height: Int,
    val srtPort: Int,
) {
    val streamKey: String = "court-$courtCode-main"
    val resolution: String = "${width}x$height"
    val srtEndpoint: String =
        "srt://$gatewayHost:$srtPort?streamid=publish:$streamKey&pkt_size=1316"

    companion object {
        private val COURT_CODE = Regex("^[A-Za-z0-9_-]{3,20}$")
        private val GATEWAY_HOST = Regex("^[A-Za-z0-9.-]+$")
        private val RESOLUTION = Regex("^(\\d{3,5})x(\\d{3,5})$")

        fun create(
            courtCode: String,
            gatewayHost: String,
            platformUrl: String,
            resolution: String,
            srtPort: Int,
        ): StreamConfig {
            val normalizedCourt = courtCode.trim()
            require(COURT_CODE.matches(normalizedCourt)) { "Некорректный код корта" }

            val normalizedGateway = gatewayHost.trim()
            require(GATEWAY_HOST.matches(normalizedGateway)) { "Некорректный адрес gateway" }

            val normalizedPlatform = platformUrl.trim().trimEnd('/')
            require(normalizedPlatform.startsWith("http://") || normalizedPlatform.startsWith("https://")) {
                "Platform URL должен начинаться с http:// или https://"
            }

            val match = RESOLUTION.matchEntire(resolution.trim())
                ?: throw IllegalArgumentException("Некорректное разрешение")
            val width = match.groupValues[1].toInt()
            val height = match.groupValues[2].toInt()
            require(width % 2 == 0 && height % 2 == 0) { "Разрешение должно быть чётным" }
            require(srtPort in 1..65535) { "Некорректный SRT-порт" }

            return StreamConfig(
                courtCode = normalizedCourt,
                gatewayHost = normalizedGateway,
                platformUrl = normalizedPlatform,
                width = width,
                height = height,
                srtPort = srtPort,
            )
        }
    }
}
