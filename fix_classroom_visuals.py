import re

def main():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    print(f"Loaded index.html ({len(html)} bytes)")

    # 1. Cập nhật ánh sáng để toàn bộ lớp học 3D sáng sủa rực rỡ và đổ bóng không bị vỡ/tối đen
    old_lights = '''    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x86efac, 0.4));
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.0);
    sunLight.position.set(28, 45, 26);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 42;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);'''

    new_lights = '''    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x86efac, 0.5));
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.0);
    sunLight.position.set(28, 45, 26);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 52;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);'''

    if old_lights in html:
        html = html.replace(old_lights, new_lights, 1)
        print("Updated global lighting and shadow camera settings")

    # 2. Xóa bỏ các biển tên cũ 'PHÒNG HỌC 10A2' bị đè trên mặt tiền hành lang
    old_signs_code = '''      const roomLayout = [
        { x: -16, name: 'PHÒNG HỌC 10A2' },
        { x: -8,  name: 'PHÒNG HỌC 10A1', hasPortal: true, roomTitle: 'PHÒNG HỌC 10A1' },
        { x: 8,   name: 'PHÒNG CLB AI', hasPortal: true, roomTitle: 'PHÒNG CLB AI & NĂNG LỰC SỐ' },
        { x: 16,  name: 'PHÒNG HỌC 11A1' }
      ];

      roomLayout.forEach(rm => {
        // Cửa đi tầng 1 & 2
        [2.1, 6.3].forEach(yPos => {
          const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.15), doorMat);
          door.position.set(rm.x, yPos, doorZ);
          // Cửa sổ chớp 2 cánh kế bên
          const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.15), winGlassMat);
          win.position.set(rm.x + 2.8, yPos + 0.35, doorZ);
          const winShutterL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.18), winFrameMat);
          winShutterL.position.set(rm.x + 1.45, yPos + 0.35, doorZ + 0.02);
          const winShutterR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.18), winFrameMat);
          winShutterR.position.set(rm.x + 4.15, yPos + 0.35, doorZ + 0.02);
          bldGroup.add(door, win, winShutterL, winShutterR);
        });

        // Biển tên lớp học
        const signTex = createSignTexture(rm.name, { width: 320, height: 72, bgColor: '#1e40af', textColor: '#ffffff', borderColor: '#fde047', fontSize: 32 });
        const roomSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }));
        roomSign.position.set(rm.x, 3.8, colZ - 0.2);
        bldGroup.add(roomSign);
      });'''

    new_signs_code = '''      // CỬA ĐI VÀ CỬA SỔ CÁC PHÒNG HỌC TẦNG 1 & TẦNG 2 DÃY BẮC
      const doorZ = northCenter.z - 0.8;
      [-16, -8, 1, 10, 18].forEach(rmX => {
        [2.1, 6.3].forEach(yPos => {
          const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.15), doorMat);
          door.position.set(rmX, yPos, doorZ);
          const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.15), winGlassMat);
          win.position.set(rmX + 2.8, yPos + 0.35, doorZ);
          const winShutterL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.18), winFrameMat);
          winShutterL.position.set(rmX + 1.45, yPos + 0.35, doorZ + 0.02);
          const winShutterR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.18), winFrameMat);
          winShutterR.position.set(rmX + 4.15, yPos + 0.35, doorZ + 0.02);
          bldGroup.add(door, win, winShutterL, winShutterR);
        });
      });'''

    if old_signs_code in html:
        html = html.replace(old_signs_code, new_signs_code, 1)
        print("Removed overlapping legacy 10A2 signboards from north building facade")

    # 3. Tinh chỉnh Collider của tòa nhà để người chơi bước trơn tru vào vòng tròn trước cửa lớp
    old_building_colliders = '''      // Thêm vùng cản vật lý bảo vệ công trình
      addCollider(northCenter.x, northCenter.z - 1.5, northWidth + 1.0, northDepth);
      addCollider(westCenter.x - 1.5, westCenter.z, westDepth, westLength + 1.0);'''

    new_building_colliders = '''      // Thêm vùng cản vật lý bảo vệ công trình (để trống hành lang trước cửa lớp Z >= -19.0 để bước vào vòng sáng dễ dàng)
      addCollider(northCenter.x, northCenter.z - 1.8, northWidth + 1.0, northDepth - 1.2);
      addCollider(westCenter.x - 1.8, westCenter.z, westDepth - 1.2, westLength + 1.0);'''

    if old_building_colliders in html:
        html = html.replace(old_building_colliders, new_building_colliders, 1)
        print("Adjusted building colliders to allow smooth walking into all classroom portal rings")

    # 4. Sửa lỗi nút thông báo phím E bên trong phòng học 3D (dùng đúng contextWrap / contextText)
    old_action_btn = '''        currentTrigger = detected;
        if (detected) {
          actionBtn.textContent = detected.label + ' [Phím E]';
          actionBtn.style.display = 'block';
        } else {
          actionBtn.style.display = 'none';
        }
        return;'''

    new_action_btn = '''        currentTrigger = detected;
        if (detected) {
          contextText.textContent = detected.label;
          contextWrap.style.display = 'block';
        } else {
          contextWrap.style.display = 'none';
        }
        return;'''

    if old_action_btn in html:
        html = html.replace(old_action_btn, new_action_btn, 1)
        print("Fixed prompt display inside 3D classroom (switched actionBtn to contextWrap)")

    # 5. Mở rộng góc máy camera trong phòng học 3D để bao quát trọn vẹn lớp học từ cửa đến bảng đen
    old_cam_bounds = '''        let clampedCamX = desiredCamX, clampedCamY = desiredCamY, clampedCamZ = desiredCamZ;
        if (isIn3DClassroom) {
          clampedCamX = THREE.MathUtils.clamp(desiredCamX, ROOM3D_BOUNDS.minX + 0.4, ROOM3D_BOUNDS.maxX - 0.4);
          clampedCamZ = THREE.MathUtils.clamp(desiredCamZ, ROOM3D_BOUNDS.minZ + 0.4, ROOM3D_BOUNDS.maxZ - 0.4);
          clampedCamY = THREE.MathUtils.clamp(desiredCamY, 1.15, 6.4);
        }'''

    new_cam_bounds = '''        let clampedCamX = desiredCamX, clampedCamY = desiredCamY, clampedCamZ = desiredCamZ;
        if (isIn3DClassroom) {
          clampedCamX = THREE.MathUtils.clamp(desiredCamX, ROOM3D_BOUNDS.minX + 0.3, ROOM3D_BOUNDS.maxX - 0.3);
          clampedCamZ = THREE.MathUtils.clamp(desiredCamZ, ROOM3D_BOUNDS.minZ + 0.3, ROOM3D_BOUNDS.maxZ - 0.3);
          clampedCamY = THREE.MathUtils.clamp(desiredCamY, 1.2, 6.8);
        }'''

    if old_cam_bounds in html:
        html = html.replace(old_cam_bounds, new_cam_bounds, 1)
        print("Optimized 3D classroom camera bounds")

    # 6. Tinh chỉnh openClassroomInterior() để camera hướng ngay vào trung tâm lớp học tuyệt đẹp
    old_open_pos = '''      // Đặt nhân vật tại cửa lớp 3D, hướng nhìn vào trong phòng học
      myPlayer.pos.set(ROOM3D_CENTER.x - 8.2, 0, ROOM3D_CENTER.z + 8.5);
      myPlayer.rotY = -0.65;
      cameraYaw = -0.62;
      cameraPitch = 0.24;
      targetCamDist = 6.2;
      currentCamDist = 6.2;'''

    new_open_pos = '''      // Đặt nhân vật ngay lối đi chính của lớp 3D, hướng thẳng lên bục giảng và bảng đen
      myPlayer.pos.set(ROOM3D_CENTER.x - 0.2, 0, ROOM3D_CENTER.z + 10.2);
      myPlayer.rotY = 0;
      cameraYaw = 0;
      cameraPitch = 0.18;
      targetCamDist = 5.8;
      currentCamDist = 5.8;'''

    if old_open_pos in html:
        html = html.replace(old_open_pos, new_open_pos, 1)
        print("Updated spawn position to center aisle facing front blackboard directly")

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("Finished updating index.html!")

if __name__ == '__main__':
    main()

