# Build context: apps/api
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props ./
COPY Zenigma.Api/Zenigma.Api.csproj Zenigma.Api/
# ReadyToRun (precompiled code) makes a cold start after Render's idle sleep noticeably faster and uses less CPU while warming up.
RUN dotnet restore Zenigma.Api/Zenigma.Api.csproj -r linux-x64
COPY Zenigma.Api/ Zenigma.Api/
RUN dotnet publish Zenigma.Api/Zenigma.Api.csproj -c Release -o /app --no-restore -r linux-x64 --self-contained false -p:PublishReadyToRun=true

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
# A small instance: workstation GC without a background thread, and no profile-guided re-JIT (saves memory and CPU).
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_gcServer=0 \
    DOTNET_gcConcurrent=0 \
    DOTNET_TieredPGO=0
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "Zenigma.Api.dll"]
