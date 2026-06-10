# Android APK 打包指南

## 前置条件（已完成 ✅）
- [x] Capacitor 项目已初始化
- [x] Android 平台已添加
- [x] 游戏文件已复制到 www/
- [x] 应用图标已生成

## 第一步：安装 Android SDK（首次使用需要）

1. 打开 **Android Studio**
2. 进入 **More Actions → SDK Manager**（或 Settings → Languages & Frameworks → Android SDK）
3. 在 **SDK Platforms** 标签，勾选 **Android 14 (API 34)**，点 Apply 下载
4. 在 **SDK Tools** 标签，确保以下已勾选：
   - Android SDK Build-Tools 34
   - Android SDK Platform-Tools
   - Android Emulator（可选）

SDK 会自动安装到：`~/Library/Android/sdk`

## 第二步：配置 SDK 路径

SDK 安装完后，在项目目录运行：
```bash
cd ~/Cube-Match-3D/android
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
```

## 第三步：用 Android Studio 打开项目

```bash
open -a "Android Studio" ~/Cube-Match-3D/android
```

或在 Android Studio 中选择 **Open** → 选择 `~/Cube-Match-3D/android` 文件夹

等待 Gradle 同步完成（首次需要几分钟下载依赖）

## 第四步：构建 Debug APK（测试用）

**方式A - 命令行**（SDK配置好后）：
```bash
cd ~/Cube-Match-3D/android
./gradlew assembleDebug
```
APK 输出位置：`android/app/build/outputs/apk/debug/app-debug.apk`

**方式B - Android Studio**：
菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**

## 第五步：构建 Release APK（发布用）

1. 生成签名密钥（只需一次）：
```bash
keytool -genkey -v -keystore ~/cubematch3d.keystore \
  -alias cubematch3d -keyalg RSA -keysize 2048 -validity 10000
```

2. 在 `android/app/build.gradle` 的 `android {}` 块中添加签名配置，
   或直接在 Android Studio 中用：**Build → Generate Signed Bundle/APK**

## 应用信息
- 包名：com.cubematch3d.game
- 版本：1.0
- 最低 Android：5.1 (API 22)
- 目标 Android：14 (API 34)

## 更新游戏内容后重新打包
```bash
cd ~/Cube-Match-3D

# 1. 复制最新 web 文件
cp Cube-Match-3D.html www/index.html
cp css/game.css www/css/
cp js/*.js www/js/

# 2. 同步到 Android
npx cap sync android

# 3. 重新构建 APK
cd android && ./gradlew assembleDebug
```
