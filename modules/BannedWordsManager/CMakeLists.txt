cmake_minimum_required(VERSION 3.14)
project(BannedWordsManagerServer)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. Add your local submodules
add_subdirectory(external/ixwebsocket)

# 2. Define your executable
# FIX: The first argument is the 'target name', the second is the source file
add_executable(bannedWordsManager_server bannedWordsManager.cpp)

# 3. Link dependencies
target_link_libraries(bannedWordsManager_server PRIVATE ixwebsocket::ixwebsocket)

# 4. Include the directory for the header-only JSON library
target_include_directories(bannedWordsManager_server PRIVATE external/nlohmann_json/include)

# BREADCRUMB: To compile:
# mkdir build
# cd build
# cmake ..
# cmake --build .
