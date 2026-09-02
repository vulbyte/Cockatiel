# Install script for directory: /Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/usr/local")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "FALSE")
endif()

# Set path to fallback-tool for dependency-resolution.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/usr/bin/objdump")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib" TYPE STATIC_LIBRARY FILES "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/libixwebsocket.a")
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libixwebsocket.a" AND
     NOT IS_SYMLINK "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libixwebsocket.a")
    execute_process(COMMAND "/usr/bin/ranlib" "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/libixwebsocket.a")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/ixwebsocket" TYPE FILE FILES
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXBase64.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXBench.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXCancellationRequest.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXConnectionState.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXDNSLookup.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXExponentialBackoff.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXGetFreePort.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXGzipCodec.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXHttp.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXHttpClient.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXHttpServer.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXNetSystem.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXProgressCallback.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSelectInterrupt.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSelectInterruptFactory.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSelectInterruptPipe.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSelectInterruptEvent.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSetThreadName.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSocket.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSocketConnect.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSocketFactory.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSocketServer.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXSocketTLSOptions.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXStrCaseCompare.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUdpSocket.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUniquePtr.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUrlParser.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUuid.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUtf8Validator.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXUserAgent.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocket.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketCloseConstants.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketCloseInfo.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketErrorInfo.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketHandshake.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketHandshakeKeyGen.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketHttpHeaders.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketInitResult.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketMessage.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketMessageType.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketOpenInfo.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketPerMessageDeflate.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketPerMessageDeflateCodec.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketPerMessageDeflateOptions.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketProxyServer.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketSendData.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketSendInfo.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketServer.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketTransport.h"
    "/Users/insert/Cockatiel/local_clients/BannedWordsManager/external/ixwebsocket/ixwebsocket/IXWebSocketVersion.h"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket" TYPE FILE FILES "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/ixwebsocket-config.cmake")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/pkgconfig" TYPE FILE FILES "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/ixwebsocket.pc")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket/ixwebsocket-targets.cmake")
    file(DIFFERENT _cmake_export_file_changed FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket/ixwebsocket-targets.cmake"
         "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/CMakeFiles/Export/dbc99e06a99e696141dafd40631f8060/ixwebsocket-targets.cmake")
    if(_cmake_export_file_changed)
      file(GLOB _cmake_old_config_files "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket/ixwebsocket-targets-*.cmake")
      if(_cmake_old_config_files)
        string(REPLACE ";" ", " _cmake_old_config_files_text "${_cmake_old_config_files}")
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket/ixwebsocket-targets.cmake\" will be replaced.  Removing files [${_cmake_old_config_files_text}].")
        unset(_cmake_old_config_files_text)
        file(REMOVE ${_cmake_old_config_files})
      endif()
      unset(_cmake_old_config_files)
    endif()
    unset(_cmake_export_file_changed)
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket" TYPE FILE FILES "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/CMakeFiles/Export/dbc99e06a99e696141dafd40631f8060/ixwebsocket-targets.cmake")
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^()$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/ixwebsocket" TYPE FILE FILES "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/CMakeFiles/Export/dbc99e06a99e696141dafd40631f8060/ixwebsocket-targets-noconfig.cmake")
  endif()
endif()

string(REPLACE ";" "\n" CMAKE_INSTALL_MANIFEST_CONTENT
       "${CMAKE_INSTALL_MANIFEST_FILES}")
if(CMAKE_INSTALL_LOCAL_ONLY)
  file(WRITE "/Users/insert/Cockatiel/local_clients/BannedWordsManager/build/external/ixwebsocket/install_local_manifest.txt"
     "${CMAKE_INSTALL_MANIFEST_CONTENT}")
endif()
