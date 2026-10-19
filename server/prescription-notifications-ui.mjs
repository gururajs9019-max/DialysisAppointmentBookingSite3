import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium, expect as baseExpect } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 25000 });
export async function runPrescriptionNotificationUi({ base, patient, doctor, admin, request, create, primaryDoctorCookie, rxId }) {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  async function signIn(page, account) {
    await page.goto(base);
    if (account.role === "doctor") {
      await page.getByRole("button",{name:/Doctor Portal/}).click();
      await page.locator('input[name="email"]').fill(account.email);
      await page.locator('input[name="password"]').fill(account.password);
      await page.getByRole("button",{name:"Login to Portal",exact:true}).click();
      await expect(page.getByRole("heading",{name:"KMC-RI Doctor Portal",exact:true})).toBeVisible();
    } else {
      await page.getByRole("button",{name:/Administrator Portal/}).click();
      await page.getByLabel("Username",{exact:true}).fill(account.username);
      await page.getByLabel("Password",{exact:true}).fill(account.password);
      await page.getByRole("button",{name:"Sign In",exact:true}).click();
      await expect(page.getByRole("heading",{name:/Today's Dialysis Patients/})).toBeVisible();
    }
    await page.getByRole("button",{name:/^Notifications(?:,|$)/}).last().click();
    await expect(page.locator("#staff-notifications-title")).toBeVisible();
  }
  try {
    const docContext = await browser.newContext({ viewport:{width:1100,height:900} });
    const adminContext = await browser.newContext({ viewport:{width:1100,height:900} });
    const docPage = await docContext.newPage(), adminPage = await adminContext.newPage();
    for (const page of [docPage,adminPage]) page.on("pageerror",error=>errors.push(error.message));
    await signIn(docPage,doctor);
    await signIn(adminPage,admin);
    const fresh = await create(primaryDoctorCookie);
    const ownNotification = async account => (await request("/api/notifications",account.cookie)).notifications.find(n=>n.record_id===fresh.id);
    const docEvent = await ownNotification(doctor), adminEvent = await ownNotification(admin);
    assert.ok(docEvent && adminEvent);
    const docCard = docPage.locator(`[data-notification-id="${docEvent.id}"]`);
    const adminCard = adminPage.locator(`[data-notification-id="${adminEvent.id}"]`);
    // No focus event, application refresh, or re-login: the existing polling
    // must deliver a prescription saved in another authenticated session.
    await expect(docCard).toBeVisible();
    await expect(adminCard).toBeVisible();
    await expect(docCard.getByText("Unread",{exact:true})).toBeVisible();
    await expect(adminCard.getByText("Unread",{exact:true})).toBeVisible();
    assert.doesNotMatch(await docCard.innerText(),/PRIVATE-/);
    for (const [page,account] of [[docPage,doctor],[adminPage,admin]]) {
      const unread = (await request("/api/notifications",account.cookie)).notifications.filter(n=>!n.read).length;
      await expect(page.getByRole("button",{name:`Notifications, ${unread} unread`,exact:true})).toBeVisible();
    }
    let failOnce = true;
    await docPage.route(`**/api/notifications/${docEvent.id}`,route=>{
      if (route.request().method()==="PATCH" && failOnce) {
        failOnce=false; return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Synthetic notification save failure"})});
      }
      return route.continue();
    });
    await docCard.getByRole("button",{name:"Mark as read",exact:true}).click();
    await expect(docPage.getByRole("alert")).toContainText("Synthetic notification save failure");
    await expect(docCard.getByText("Unread",{exact:true})).toBeVisible();
    await docPage.getByRole("button",{name:"Retry",exact:true}).click();
    await expect(docCard.getByText("Read",{exact:true})).toBeVisible();
    await signIn(docPage,doctor);
    await expect(docCard.getByText("Read",{exact:true})).toBeVisible();
    await docCard.getByRole("button",{name:"Mark unread",exact:true}).click();
    await expect(docCard.getByText("Unread",{exact:true})).toBeVisible();
    assert.equal((await request("/api/notifications",admin.cookie)).notifications.find(n=>n.id===adminEvent.id).read,false);

    for (const [page,account] of [[docPage,doctor],[adminPage,admin]]) {
      const old = (await request("/api/notifications",account.cookie)).notifications.find(n=>n.record_id===rxId);
      await page.locator(`[data-notification-id="${old.id}"]`).getByRole("button",{name:"Open prescription",exact:true}).click();
      await expect(page.getByText("PRIVATE-ADMIN-REVISION",{exact:true})).toBeVisible();
      assert.equal((await request("/api/notifications",account.cookie)).notifications.find(n=>n.id===old.id).read,true);
      await page.getByRole("button",{name:/^Notifications(?:,|$)/}).last().click();
      await expect(page.locator("#staff-notifications-title")).toBeVisible();
      await page.getByRole("button",{name:"Mark all read",exact:true}).click();
      await expect(page.locator("#staff-notifications-title").locator("..").getByText(/You are up to date/)).toBeVisible();
      assert.ok((await request("/api/notifications",account.cookie)).notifications.every(n=>n.read));
    }
    await docPage.setViewportSize({width:900,height:1100});
    await adminPage.setViewportSize({width:390,height:844});
    for (const page of [docPage,adminPage]) {
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,"notification layout fits viewport");
    }
    await docPage.screenshot({path:"/tmp/doctor-prescription-notifications.png",fullPage:true});
    await adminPage.screenshot({path:"/tmp/admin-prescription-notifications.png",fullPage:true});
    const changed = execFileSync("git",["diff","--name-only"],{encoding:"utf8"}).trim().split("\n");
    assert.ok(!changed.some(path=>/PatientApp|PatientAuthPortal|src\/app\/App\.tsx|src\/app\/MainApp\.tsx/.test(path)),
      "patient portal and role routing source remain unchanged");
    assert.deepEqual(errors,[],"staff notification pages have no runtime errors");
    console.log("staff notification UI passed: cross-session polling in both portals, counts, saved read/unread and bulk read, failure/retry, re-login persistence, exact historical prescription links, mobile/tablet layout, patient portal source isolation");
  } finally { await browser.close(); }
}
